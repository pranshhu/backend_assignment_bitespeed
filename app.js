const express = require('express');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Main identify endpoint
app.post('/identify', async (req, res) => {
  try {
    const { email, phoneNumber } = req.body;

    // Validation
    if (!email && !phoneNumber) {
      return res.status(400).json({ error: 'Either email or phoneNumber is required' });
    }

    // Find existing contacts
    const existingContacts = await findExistingContacts(email, phoneNumber);

    if (existingContacts.length === 0) {
      // Create new primary contact
      const newContact = await prisma.contact.create({
        data: {
          email: email || null,
          phoneNumber: phoneNumber || null,
          linkPrecedence: 'primary'
        }
      });
      return res.json(buildResponse([newContact]));
    }

    // Check if we need to create a new contact
    const exactMatch = existingContacts.find(c => 
      c.email === email && c.phoneNumber === phoneNumber
    );

    if (!exactMatch) {
      const hasNewInfo = 
        (email && !existingContacts.some(c => c.email === email)) ||
        (phoneNumber && !existingContacts.some(c => c.phoneNumber === phoneNumber));

      if (hasNewInfo) {
        const primary = existingContacts.find(c => c.linkPrecedence === 'primary');
        const newContact = await prisma.contact.create({
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

    // Handle primary contact merging
    const finalContacts = await handlePrimaryMerging(existingContacts);
    
    res.json(buildResponse(finalContacts));
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Find existing contacts
async function findExistingContacts(email, phoneNumber) {
  const conditions = [];
  if (email) conditions.push({ email });
  if (phoneNumber) conditions.push({ phoneNumber });

  const directMatches = await prisma.contact.findMany({
    where: { OR: conditions }
  });

  if (directMatches.length === 0) return [];

  // Find all linked contacts
  const allLinked = new Set();
  for (const contact of directMatches) {
    const primaryId = contact.linkedId || contact.id;
    const linkedChain = await prisma.contact.findMany({
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

// Handle primary contact merging
async function handlePrimaryMerging(contacts) {
  const primaries = contacts.filter(c => c.linkPrecedence === 'primary');
  
  if (primaries.length <= 1) return contacts;

  // Find oldest primary
  const oldestPrimary = primaries.reduce((oldest, current) => 
    current.createdAt < oldest.createdAt ? current : oldest
  );

  // Convert other primaries to secondary
  for (const primary of primaries) {
    if (primary.id !== oldestPrimary.id) {
      await prisma.contact.update({
        where: { id: primary.id },
        data: {
          linkedId: oldestPrimary.id,
          linkPrecedence: 'secondary'
        }
      });

      // Update contacts linked to this primary
      await prisma.contact.updateMany({
        where: { linkedId: primary.id },
        data: { linkedId: oldestPrimary.id }
      });
    }
  }

  // Return updated contacts
  return await prisma.contact.findMany({
    where: {
      OR: [
        { id: oldestPrimary.id },
        { linkedId: oldestPrimary.id }
      ]
    }
  });
}

// Build response
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
      primaryContatctId: primary.id, // Note: keeping the typo from assignment
      emails,
      phoneNumbers,
      secondaryContactIds: secondaries.map(c => c.id)
    }
  };
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
