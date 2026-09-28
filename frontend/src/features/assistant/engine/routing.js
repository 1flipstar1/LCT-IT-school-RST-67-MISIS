const CRM_CONTEXT = /(вуз|заявк|этап|отчет|отчёт|карточк|договор|менеджер|сотрудник|пользовател|кфу|аналитик|справочн|интеграц|лмс|lms)/;
const SOCIAL_START = /^(привет|здравствуй(те)?|доброе утро|добрый (день|вечер)|hello|hi|как (у тебя )?дела|как ты|ты как|как настроение|как поживаешь|готов[аы]? (ли )?(ты )?(к работе|работать|помочь)|ты (тут|на связи|готова работать)|можем поговорить|поболтаем|поговорим|чем ты занимаешься|что нового|спасибо|благодарю|спс|супер|отлично|класс|поехали|ну что[,]?\s*поехали|начинаем|начнем|давай начнем|а у тебя|и у тебя|рад тебя видеть)(?=\s|[!?.,]|$)/;
const SOCIAL_FOLLOWUP = /^(да|нет|конечно|давай|расскажи еще|и что дальше|почему|а ты|а у тебя)(?=\s|[!?.,]|$)/;

export function isConversationalMessage(message, history = []) {
  const text = message.toLowerCase().replaceAll('ё', 'е').trim();
  if (CRM_CONTEXT.test(text) || (text.startsWith('как дела у ') && !text.startsWith('как дела у тебя'))) return false;
  if (SOCIAL_START.test(text)) return true;
  if (SOCIAL_FOLLOWUP.test(text) && text.split(/\s+/).length <= 5) {
    const previous = [...history].reverse().find((turn) => turn.role === 'user');
    return Boolean(previous && isConversationalMessage(previous.text ?? previous.content));
  }
  return false;
}

/** Свободные вопросы и обычный разговор уходят модели, если она доступна. */
export function shouldExplainWithModel(engine, local, model, message = '', history = []) {
  return engine === 'auto'
    && (isConversationalMessage(message, history)
      || (local?.kind === 'answer' && Boolean((local.article && local.article.id !== 'stages') || local.source === 'capabilities')))
    && model.state !== 'disabled' && (model.state !== 'offline' || model.stale);
}
