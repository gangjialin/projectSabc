/**
 * 仪表盘占位页。后续按 design §6.1 拆分为
 * /admin /reviewer /peer /student /display /teacher /tracking 等分组路由。
 */
export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-2xl font-semibold">仪表盘</h1>
      <p className="mt-2 text-slate-500">
        脚手架已就绪。后续里程碑将在此接入：数据导入、5 维度评分、维度否决看板、
        全院排名与等级分布。
      </p>
    </main>
  );
}
