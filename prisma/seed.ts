import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Check if data already exists
    const existingUser = await prisma.user.findFirst({
        where: { email: 'lamhaichat@gmail.com' }
    });

    if (existingUser) {
        console.log('✅ Data already exists, skipping seed.');
        return;
    }

    // ================================
    // 1. Create User
    // ================================
    const hashedPassword = await bcrypt.hash('123456', 10);

    const user = await prisma.user.create({
        data: {
            name: 'Hoàng Đình Lâm Hải',
            email: 'lamhaichat@gmail.com',
            phone: '0901234567',
            password: hashedPassword,
            role: 'patient',
            provider: 'credentials',
            isActive: true,
            gender: 'male',
            address: 'Đà Nẵng, Việt Nam',
        },
    });
    console.log('✅ Created user:', user.email);

    // Create admin user
    const adminUser = await prisma.user.create({
        data: {
            name: 'Admin System',
            email: 'admin@clinic.com',
            phone: '0900000001',
            password: hashedPassword,
            role: 'admin',
            provider: 'credentials',
            isActive: true,
        },
    });
    console.log('✅ Created admin:', adminUser.email);

    // ================================
    // 2. Create Clinics
    // ================================
    const clinic1 = await prisma.clinic.create({
        data: {
            name: 'Bệnh viện Thiện Nhân Đà Nẵng',
            address: '125 Lê Lợi, Hải Châu, Đà Nẵng',
            email: 'danang@thiennhan.vn',
            phone: '0236 3822 118',
            description: 'Bệnh viện đa khoa chất lượng cao tại Đà Nẵng, chuyên khám và điều trị các bệnh lý nội khoa, ngoại khoa, sản phụ khoa.',
            imageUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800',
        },
    });
    console.log('✅ Created clinic:', clinic1.name);

    const clinic2 = await prisma.clinic.create({
        data: {
            name: 'Bệnh viện Thiện Nhân Quảng Ngãi',
            address: '88 Phan Đình Phùng, TP. Quảng Ngãi',
            email: 'quangngai@thiennhan.vn',
            phone: '0255 3822 119',
            description: 'Chi nhánh Quảng Ngãi của hệ thống Bệnh viện Thiện Nhân, phục vụ người dân khu vực miền Trung.',
            imageUrl: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800',
        },
    });
    console.log('✅ Created clinic:', clinic2.name);

    // ================================
    // 3. Create Services (all prices = 2000 for testing)
    // ================================
    const services = await Promise.all([
        prisma.service.create({
            data: {
                name: 'Khám tổng quát',
                description: 'Khám sức khỏe tổng quát, kiểm tra các chỉ số cơ bản',
                price: 2000,
                durationMinutes: 30,
            },
        }),
        prisma.service.create({
            data: {
                name: 'Khám nội khoa',
                description: 'Khám và điều trị các bệnh lý nội khoa như tim mạch, tiêu hóa, hô hấp',
                price: 2000,
                durationMinutes: 30,
            },
        }),
        prisma.service.create({
            data: {
                name: 'Khám ngoại khoa',
                description: 'Khám và tư vấn các bệnh lý ngoại khoa, chấn thương',
                price: 2000,
                durationMinutes: 30,
            },
        }),
        prisma.service.create({
            data: {
                name: 'Khám sản phụ khoa',
                description: 'Khám và chăm sóc sức khỏe phụ nữ, thai sản',
                price: 2000,
                durationMinutes: 30,
            },
        }),
        prisma.service.create({
            data: {
                name: 'Khám nhi khoa',
                description: 'Khám và điều trị các bệnh lý ở trẻ em',
                price: 2000,
                durationMinutes: 30,
            },
        }),
    ]);
    console.log('✅ Created', services.length, 'services (all prices = 2000)');

    // ================================
    // 4. Create Doctor Users
    // ================================
    const doctorUser1 = await prisma.user.create({
        data: {
            name: 'BS. Nguyễn Văn An',
            email: 'bs.an@thiennhan.vn',
            phone: '0901111111',
            password: hashedPassword,
            role: 'doctor',
            provider: 'credentials',
            isActive: true,
            gender: 'male',
        },
    });

    const doctorUser2 = await prisma.user.create({
        data: {
            name: 'BS. Trần Thị Bình',
            email: 'bs.binh@thiennhan.vn',
            phone: '0902222222',
            password: hashedPassword,
            role: 'doctor',
            provider: 'credentials',
            isActive: true,
            gender: 'female',
        },
    });

    const doctorUser3 = await prisma.user.create({
        data: {
            name: 'BS. Lê Minh Châu',
            email: 'bs.chau@thiennhan.vn',
            phone: '0903333333',
            password: hashedPassword,
            role: 'doctor',
            provider: 'credentials',
            isActive: true,
            gender: 'male',
        },
    });
    console.log('✅ Created 3 doctor users');

    // ================================
    // 5. Create Doctors (all prices = 2000 for testing)
    // ================================
    const doctor1 = await prisma.doctor.create({
        data: {
            userId: doctorUser1.id,
            clinicId: clinic1.id,
            specialty: 'Nội khoa',
            degree: 'Thạc sĩ Y khoa',
            pricePerSlot: 2000,
            bio: 'Bác sĩ Nguyễn Văn An có 15 năm kinh nghiệm trong lĩnh vực nội khoa, chuyên điều trị các bệnh lý tim mạch và tiêu hóa.',
            isAvailable: true,
        },
    });

    const doctor2 = await prisma.doctor.create({
        data: {
            userId: doctorUser2.id,
            clinicId: clinic1.id,
            specialty: 'Sản phụ khoa',
            degree: 'Tiến sĩ Y khoa',
            pricePerSlot: 2000,
            bio: 'Bác sĩ Trần Thị Bình chuyên về sản phụ khoa với hơn 10 năm kinh nghiệm chăm sóc sức khỏe phụ nữ.',
            isAvailable: true,
        },
    });

    const doctor3 = await prisma.doctor.create({
        data: {
            userId: doctorUser3.id,
            clinicId: clinic2.id,
            specialty: 'Nhi khoa',
            degree: 'Bác sĩ Chuyên khoa II',
            pricePerSlot: 2000,
            bio: 'Bác sĩ Lê Minh Châu yêu trẻ em và tận tâm chăm sóc sức khỏe cho các bé.',
            isAvailable: true,
        },
    });
    console.log('✅ Created 3 doctors (all prices = 2000)');

    // ================================
    // 6. Create Doctor Services (many-to-many)
    // ================================
    await Promise.all([
        // Doctor 1 - Nội khoa services
        prisma.doctorService.create({
            data: { doctorId: doctor1.id, serviceId: services[0].id } // Khám tổng quát
        }),
        prisma.doctorService.create({
            data: { doctorId: doctor1.id, serviceId: services[1].id } // Khám nội khoa
        }),
        // Doctor 2 - Sản phụ khoa
        prisma.doctorService.create({
            data: { doctorId: doctor2.id, serviceId: services[0].id } // Khám tổng quát
        }),
        prisma.doctorService.create({
            data: { doctorId: doctor2.id, serviceId: services[3].id } // Khám sản phụ khoa
        }),
        // Doctor 3 - Nhi khoa
        prisma.doctorService.create({
            data: { doctorId: doctor3.id, serviceId: services[0].id } // Khám tổng quát
        }),
        prisma.doctorService.create({
            data: { doctorId: doctor3.id, serviceId: services[4].id } // Khám nhi khoa
        }),
    ]);
    console.log('✅ Created doctor-service relationships');

    // ================================
    // 7. Create Doctor Schedules (next 14 days, skip Saturday & Sunday)
    // Full day schedules with many slots for easy testing
    // ================================
    const today = new Date();
    const schedules: any[] = [];

    for (let i = 1; i <= 14; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);

        // Skip Saturday (6) and Sunday (0)
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            console.log(`  Skipping ${date.toDateString()} (weekend)`);
            continue;
        }

        // Morning shift: 07:00 - 12:00 (many slots)
        schedules.push(
            prisma.doctorSchedule.create({
                data: {
                    doctorId: doctor1.id,
                    date: date,
                    shiftName: 'Sáng',
                    startTime: new Date('1970-01-01T07:00:00'),
                    endTime: new Date('1970-01-01T12:00:00'),
                    maxPatients: 20,
                    isAvailable: true,
                },
            }),
            prisma.doctorSchedule.create({
                data: {
                    doctorId: doctor2.id,
                    date: date,
                    shiftName: 'Sáng',
                    startTime: new Date('1970-01-01T07:00:00'),
                    endTime: new Date('1970-01-01T12:00:00'),
                    maxPatients: 20,
                    isAvailable: true,
                },
            }),
            prisma.doctorSchedule.create({
                data: {
                    doctorId: doctor3.id,
                    date: date,
                    shiftName: 'Sáng',
                    startTime: new Date('1970-01-01T07:00:00'),
                    endTime: new Date('1970-01-01T12:00:00'),
                    maxPatients: 20,
                    isAvailable: true,
                },
            })
        );

        // Afternoon shift: 13:00 - 18:00 (many slots)
        schedules.push(
            prisma.doctorSchedule.create({
                data: {
                    doctorId: doctor1.id,
                    date: date,
                    shiftName: 'Chiều',
                    startTime: new Date('1970-01-01T13:00:00'),
                    endTime: new Date('1970-01-01T18:00:00'),
                    maxPatients: 20,
                    isAvailable: true,
                },
            }),
            prisma.doctorSchedule.create({
                data: {
                    doctorId: doctor2.id,
                    date: date,
                    shiftName: 'Chiều',
                    startTime: new Date('1970-01-01T13:00:00'),
                    endTime: new Date('1970-01-01T18:00:00'),
                    maxPatients: 20,
                    isAvailable: true,
                },
            }),
            prisma.doctorSchedule.create({
                data: {
                    doctorId: doctor3.id,
                    date: date,
                    shiftName: 'Chiều',
                    startTime: new Date('1970-01-01T13:00:00'),
                    endTime: new Date('1970-01-01T18:00:00'),
                    maxPatients: 20,
                    isAvailable: true,
                },
            })
        );
    }

    await Promise.all(schedules);
    console.log('✅ Created doctor schedules for next 14 weekdays (Mon-Fri only)');
    console.log('   - Morning: 07:00-12:00, max 20 patients/slot');
    console.log('   - Afternoon: 13:00-18:00, max 20 patients/slot');

    console.log('🎉 Seeding completed successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
