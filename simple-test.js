// Simple test without database - just to verify the logic works
const express = require('express');

const app = express();
app.use(express.json());

// Mock data store (in-memory for testing)
let contacts = [];
let nextId = 1;

// Mock Prisma functions
const mockPrisma = {
  contact: {
    create: async (data) => {
      const contact = {
        id: nextId++,
        email: data.data.email,
        phoneNumber: data.data.phoneNumber,
        linkedId: data.data.linkedId || null,
        linkPrecedence: data.data.linkPrecedence,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      contacts.push(contact);
      return contact;
    },
    findMany: async (query) => {
      if (query.where.OR) {
        return contacts.filter(c => 
          query.where.OR.some(condition => 
            (condition.email && c.email === condition.email) ||
            (condition.phoneNumber && c.phoneNumber === condition.phoneNumber) ||
            (condition.id && c.id === condition.id) ||
            (condition.linkedId && c.linkedId === condition.linkedId)
          )
        );
      }
      return contacts;
    },
    update: async (query) => {
      const contact = contacts.find(c => c.id === query.where.id);
      if (contact) {
        Object.assign(contact, query.data);
        contact.updatedAt = new Date();
      }
      return contact;
    },
    updateMany: async (query) => {
      contacts.forEach(c => {
        if (c.linkedId === query.where.linkedId) {
          Object.assign(c, query.data);
          c.updatedAt = new Date();
        }
      });
    }
  }
};

// Copy the main logic from app.js but use mock prisma
app.post('/identify', async (req, res) => {
  try {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
      return res.status(400).json({ error: 'Either email or phoneNumber is required' });
    }

    const existingContacts = await findExistingContacts(email, phoneNumber);

    if (existingContacts.length === 0) {
      const newContact = await mockPrisma.contact.create({
        data: {
          email: email || null,
          phoneNumber: phoneNumber || null,
          linkPrecedence: 'primary'
        }
      });
      return res.json(buildResponse([newContact]));
    }

    const exactMatch = existingContacts.find(c => 
      c.email === email && c.phoneNumber === phoneNumber
    );

    if (!exactMatch) {
      const hasNewInfo = 
        (email && !existingContacts.some(c => c.email === email)) ||
        (phoneNumber && !existingContacts.some(c => c.phoneNumber === phoneNumber));

      if (hasNewInfo) {
        const primary = existingContacts.find(c => c.linkPrecedence === 'primary');
        const newContact = await mockPrisma.contact.create({
          data: {
            email: email || null,
            phoneNumber: phoneNumber || null,
            linkedId: primary.id,
            linkPrecedence: 'secondary'
          }
        });
        existingContacts.push(newContact);
      }
    }

    const finalContacts = await handlePrimaryMerging(existingContacts);
    res.json(buildResponse(finalContacts));
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function findExistingContacts(email, phoneNumber) {
  const conditions = [];
  if (email) conditions.push({ email });
  if (phoneNumber) conditions.push({ phoneNumber });

  const directMatches = await mockPrisma.contact.findMany({
    where: { OR: conditions }
  });

  if (directMatches.length === 0) return [];

  const allLinked = new Set();
  for (const contact of directMatches) {
    const primaryId = contact.linkedId || contact.id;
    const linkedChain = await mockPrisma.contact.findMany({
      where: {
        OR: [
          { id: primaryId },
          { linkedId: primaryId }
        ]
      }
    });
    linkedChain.forEach(c => allLinked.add(c));
  }

  return Array.from(allLinked);
}

async function handlePrimaryMerging(contacts) {
  const primaries = contacts.filter(c => c.linkPrecedence === 'primary');
  
  if (primaries.length <= 1) return contacts;

  const oldestPrimary = primaries.reduce((oldest, current) => 
    current.createdAt < oldest.createdAt ? current : oldest
  );

  for (const primary of primaries) {
    if (primary.id !== oldestPrimary.id) {
      await mockPrisma.contact.update({
        where: { id: primary.id },
        data: {
          linkedId: oldestPrimary.id,
          linkPrecedence: 'secondary'
        }
      });

      await mockPrisma.contact.updateMany({
        where: { linkedId: primary.id },
        data: { linkedId: oldestPrimary.id }
      });
    }
  }

  return await mockPrisma.contact.findMany({
    where: {
      OR: [
        { id: oldestPrimary.id },
        { linkedId: oldestPrimary.id }
      ]
    }
  });
}

function buildResponse(contacts) {
  const primary = contacts.find(c => c.linkPrecedence === 'primary');
  const secondaries = contacts.filter(c => c.linkPrecedence === 'secondary');

  const emails = [primary.email, ...secondaries.map(c => c.email)]
    .filter(email => email !== null)
    .filter((email, index, arr) => arr.indexOf(email) === index);

  const phoneNumbers = [primary.phoneNumber, ...secondaries.map(c => c.phoneNumber)]
    .filter(phone => phone !== null)
    .filter((phone, index, arr) => arr.indexOf(phone) === index);

  return {
    contact: {
      primaryContatctId: primary.id,
      emails,
      phoneNumbers,
      secondaryContactIds: secondaries.map(c => c.id)
    }
  };
}

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.get('/debug', (req, res) => {
  res.json({ contacts });
});

const PORT = 3001; // Different port to avoid conflicts
app.listen(PORT, () => {
  console.log(`Simple test server running on port ${PORT}`);
  console.log('Test endpoints:');
  console.log(`- POST http://localhost:${PORT}/identify`);
  console.log(`- GET http://localhost:${PORT}/health`);
  console.log(`- GET http://localhost:${PORT}/debug`);
});
