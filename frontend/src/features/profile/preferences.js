export const DEFAULT_PREFERENCES = {
  avatar: null,
  reduceMotion: false,
  showBadges: true,
  interactionView: 'table',
  interactionSort: 'urgency',
};

export function normalizePreferences(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    avatar: typeof source.avatar === 'string' ? source.avatar : null,
    reduceMotion: source.reduceMotion === true,
    showBadges: source.showBadges !== false,
    interactionView: ['table', 'board'].includes(source.interactionView) ? source.interactionView : 'table',
    interactionSort: ['urgency', 'updated', 'university', 'progress'].includes(source.interactionSort) ? source.interactionSort : 'urgency',
  };
}
