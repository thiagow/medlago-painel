import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function checkUser() {
    const user = await prisma.user.findUnique({
        where: { email: 'admin@medlago.com' }
    });

    if (!user) {
        console.log('User not found!');
        return;
    }

    console.log('User:', user.email, 'Active:', user.active);
    const match = await bcrypt.compare('MedLago@2024', user.password_hash);
    console.log('Password match:', match);
}

checkUser().finally(() => prisma.$disconnect());
