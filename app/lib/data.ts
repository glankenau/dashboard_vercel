import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  User,
  Revenue,
  FormattedCustomersTable,
  LatestInvoice
} from './definitions';
import { formatCurrency } from './utils';
import { unstable_noStore as noStore } from 'next/cache';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function fetchRevenue() {
  // Add noStore() here to prevent the response from being cached.
  // This is equivalent to in fetch(..., {cache: 'no-store'}).
  noStore();

  try {
    const result = await prisma.$queryRaw<Revenue[]>`SELECT * FROM revenues`;

    return result;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  noStore();
  try {
    const data = await prisma.invoice.findMany(
      {
        select: {
          amount: true,
          id: true,
          customer: {
            select: {
              name: true,
              image: true,
              email: true
            },
          },
        },
      orderBy: {
        date: 'desc'
      },
      take: 5
      }
    );
    const latestInvoices = data.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
  noStore();
  try {

    const invoiceCountPromise = await prisma.invoice.count();
    const customerCountPromise = await prisma.customer.count();
    const paidInvoicePromise = await prisma.invoice.groupBy({
      by: ['status'],
      where: {
        status: 'paid'
      },
      _sum: {
        amount: true
      }
    });
    const pendingInvoicePromise = await prisma.invoice.groupBy({
      by: ['status'],
      where: {
        status: 'pending'
      },
      _sum: {
        amount: true
      }
    })

    const data = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      paidInvoicePromise,
      pendingInvoicePromise,
    ]);

    const invoiceCount = data[0];
    const customerCount = data[1];
    const paidSum = data[2][0]._sum['amount'];
    const pendingSum = data[3][0]._sum['amount'];

    const numberOfInvoices = Number(invoiceCount ?? '0');
    const numberOfCustomers = Number(customerCount ?? '0');
    const totalPaidInvoices = formatCurrency(paidSum ?? '0');
    const totalPendingInvoices = formatCurrency(pendingSum ?? '0');

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  noStore();
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const invoices = await prisma.$queryRaw<InvoicesTable[]>`
      SELECT
        invoices.id,
        invoices.amount,
        invoices.date,
        invoices.status,
        customers.name,
        customers.email,
        customers.image
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`} OR
        invoices.amount::text ILIKE ${`%${query}%`} OR
        invoices.date::text ILIKE ${`%${query}%`} OR
        invoices.status ILIKE ${`%${query}%`}
      ORDER BY invoices.date DESC
      LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `;
    return invoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
  noStore();
  try {
    const count = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*) FROM invoices 
      JOIN customers ON invoices.customer_id = customers.id 
      WHERE (
        customers.name ILIKE $1 OR
        customers.email ILIKE $1 OR
        invoices.amount::text ILIKE $1 OR
        invoices.date::text ILIKE $1 OR
        invoices.status ILIKE $1)`,
        `%${query}%`
      );

    const totalPages = Math.ceil(Number(count[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
  noStore();
  try {
    const data = await prisma.invoice.findMany(
      {
        where: {
          id: `${id}`
        }
      }
    )

    const invoice = data.map((invoice) => ({
      ...invoice,
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    }));

    return invoice;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  noStore();
  try {

    const data = await prisma.customer.findMany(
      {
        orderBy: [ { name: 'asc' } ]
      }
    )

    return data;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchFormattedCustomers() {
  try {
    const data = await prisma.$queryRaw<FormattedCustomersTable[]>`
      SELECT
        customers.id,
        customers.name,
        customers.email,
        customers.image,
        COUNT(invoices.id) as total_invoices,
        SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
        SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
      FROM customers
      LEFT JOIN invoices on customers.id = invoices.customer_id
      GROUP BY customers.id, customers.name, customers.email, customers.image
      ORDER BY name ASC
    `;

    return data;
  } catch(err) {
    console.error('Database Error:', err);
    throw new Error("Failed to fetch all customers.");
  }
}

export async function fetchFilteredCustomers(query: string) {
  noStore();
  try {
    const data = await prisma.$queryRaw<CustomersTableType[]>`
		SELECT
		  customers.id,
		  customers.name,
		  customers.email,
		  customers.image,
		  COUNT(invoices.id) AS total_invoices,
		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		FROM customers
		LEFT JOIN invoices ON customers.id = invoices.customer_id
		WHERE
		  customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`}
		GROUP BY customers.id, customers.name, customers.email, customers.image
		ORDER BY customers.name ASC
	  `;

    const customers = data.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}

export async function getUser(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: {
        email: `${email}`
      }
    })
    return user;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}
