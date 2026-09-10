export const inject = ["sessionController", "sessionPersistence", "sessionQuery"];

export function apply(ctx) {
  // This private parent-process channel is unavailable to web pages and models.
  // The desktop owns the final shutdown and filesystem removal.
  if (!process.send) return;
  const listener = async (message) => {
    if (message?.type !== "desktop-chat:prepare-delete") return;
    const reply = (result) => process.send?.({ type: "desktop-chat:delete-ready", requestId: message.requestId, ...result });
    try {
      const { items } = await ctx.sessionController.list({}, AbortSignal.timeout(15_000));
      if (!items.some((item) => item.sessionId === message.sessionId)) throw new Error("对话不存在，请刷新后重试");
      if (items.some((item) => item.running)) throw new Error("有任务正在运行，请等待任务结束后再完全删除对话");
      await ctx.sessionPersistence.flush();
      reply({ ok: true, root: ctx.sessionPersistence.config.root, queryPath: ctx.sessionQuery.config.path });
    } catch (error) {
      reply({ ok: false, error: error.message });
    }
  };
  process.on("message", listener);
  ctx.effect(() => () => process.off("message", listener));
}
