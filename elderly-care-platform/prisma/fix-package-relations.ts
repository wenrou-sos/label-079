import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma"
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error('DATABASE_URL 未设置')
  process.exit(1)
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter })

async function main() {
  const orders = await prisma.order.findMany({
    where: { remark: { contains: 'PKG' } },
    orderBy: { id: 'asc' }
  })

  console.log(`找到 ${orders.length} 条套餐订单`)

  for (const order of orders) {
    if (order.packageServiceId) {
      console.log(`订单 ${order.id} 已关联 packageServiceId=${order.packageServiceId}，跳过`)
      continue
    }

    const pkgService = await prisma.packageService.findFirst({
      where: { orderId: order.id }
    })

    if (pkgService) {
      await prisma.order.update({
        where: { id: order.id },
        data: { packageServiceId: pkgService.id }
      })
      console.log(`修复订单 ${order.id} -> packageServiceId=${pkgService.id}`)
    } else {
      console.log(`订单 ${order.id} 未找到对应的 PackageService`)
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
