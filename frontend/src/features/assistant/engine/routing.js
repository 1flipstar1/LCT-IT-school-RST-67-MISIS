/** Free-form help questions go to the grounded model when it is available. */
export function shouldExplainWithModel(engine, local, model) {
  return engine === 'auto' && local?.kind === 'answer'
    && Boolean((local.article && local.article.id !== 'stages') || local.source === 'capabilities')
    && model.state !== 'disabled' && (model.state !== 'offline' || model.stale);
}
