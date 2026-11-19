import bcrypt from 'bcryptjs';
import { db } from './lib/db';
import { env } from './config/env';
import { ensureBucket } from './lib/storage';
const categories = [['POTHOLE', 'Buracos em vias públicas', 'pothole', '#D97706', 'Obras'], ['LIGHTING', 'Falhas na iluminação pública', 'bulb', '#EAB308', 'Iluminação Pública'], ['WASTE', 'Descarte irregular de lixo', 'trash', '#15803D', 'Serviços Urbanos'], ['WATER', 'Vazamentos de água', 'drop', '#0284C7', 'Serviços Urbanos'], ['TREE', 'Queda de árvores', 'tree', '#16A34A', 'Meio Ambiente'], ['SIGN', 'Problemas de sinalização', 'sign', '#DC2626', 'Obras'], ['OTHER', 'Outros', 'more', '#64748B', 'Serviços Urbanos']] as const;
async function main() {
    if (!await db.user.findUnique({ where: { email: env.ADMIN_EMAIL.toLowerCase() } }))
        await db.user.create({ data: { email: env.ADMIN_EMAIL.toLowerCase(), name: 'Gestor Municipal', role: 'ADMIN', passwordHash: await bcrypt.hash(env.ADMIN_PASSWORD, 12) } });
    for (const [code, name, icon, color, department] of categories) {
        const c = await db.category.upsert({ where: { code }, create: { code, name, icon, color }, update: {} });
        const s = await db.secretariat.upsert({ where: { name: department }, create: { name: department }, update: {} });
        await db.secretariatCategory.upsert({ where: { secretariatId_categoryId: { secretariatId: s.id, categoryId: c.id } }, create: { secretariatId: s.id, categoryId: c.id }, update: {} });
    }
    for (const [code, name, description, categoryCodes, bronze, silver, gold] of [['CITY', 'Fiscal da Cidade', 'Registros validados', [], 5, 25, 100], ['NEIGHBORHOOD', 'Guardião do Bairro', 'Registros no mesmo bairro', [], 5, 20, 50], ['ENVIRONMENT', 'Agente Ambiental', 'Registros ambientais', ['WASTE', 'TREE', 'WATER'], 5, 20, 50]] as const) {
        await db.medalDefinition.upsert({ where: { code }, create: { code, name, description, categoryCodes: [...categoryCodes], bronze, silver, gold }, update: {} });
    }
    for (const [key, value] of [['duplicateRadius', env.DUPLICATE_RADIUS_METERS], ['duplicateHours', env.DUPLICATE_WINDOW_HOURS], ['monthlyBonus', env.MONTHLY_BONUS_POINTS]] as const)
        await db.setting.upsert({ where: { key }, create: { key, value }, update: {} });
    if (env.SEED_DEMO) {
        if (!await db.announcement.count())
            await db.announcement.create({ data: { title: "Bem-vindo ao UrbanizaGO", body: "Registre problemas urbanos com foto e localização e acompanhe o atendimento." } });
        const c = await db.category.findUniqueOrThrow({ where: { code: 'POTHOLE' } });
        await db.notificationRecipient.upsert({ where: { email: 'obras@urbanizago.local' }, create: { email: 'obras@urbanizago.local', name: 'Obras (demonstração)', active: true, confirmedAt: new Date(), categories: { create: { categoryId: c.id } } }, update: {} });
        await db.user.upsert({ where: { email: 'cidadao@urbanizago.local' }, create: { email: 'cidadao@urbanizago.local', name: 'Cidadão Demonstração', passwordHash: await bcrypt.hash('Cidadao-dev-2026!', 12), neighborhood: 'Centro' }, update: {} });
    }
    await ensureBucket();
}
main().catch(() => { console.error('Falha ao preparar os dados iniciais. Verifique a configuração.'); process.exitCode = 1; }).finally(() => db.$disconnect());

