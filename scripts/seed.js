const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const bcrypt = require('bcrypt');
const {
  invoices,
  customers,
  revenue,
  users,
} = require('../app/lib/placeholder-data.js');

async function main() {

  const encryptedUsers = await Promise.all(
    users.map(async (user) => {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      return { ...user, password: hashedPassword}
    })
  );
  const seedUsers = await prisma.user.createMany({
    data: encryptedUsers
  });

  console.log(seedUsers);

  const seedCustomers = await prisma.customer.createMany({
    data: customers
  });

  console.log(seedCustomers);

  const seedInvoices = await prisma.invoice.createMany({
    data: invoices
  });

  console.log(seedInvoices);

  const seedRevenue = await prisma.revenue.createMany({
    data: revenue
  });

  console.log(seedRevenue);
}

main()
  .then(async() => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.log(e)
    await prisma.$disconnect()
    process.exit(1)
  });

