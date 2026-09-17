/** Склеивает CSS-классы, отбрасывая пустые значения: cn(styles.row, isActive && styles.active). */
export const cn = (...classNames) => classNames.filter(Boolean).join(' ');
