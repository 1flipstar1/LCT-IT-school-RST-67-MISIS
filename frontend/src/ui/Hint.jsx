// Прямой путь к компоненту: индекс ui-kit в CommonJS тянет в бандл все компоненты кита.
import PopoverModule from '@atomaro/ui-kit/components/Popover/Popover';
import { interopDefault } from '../lib/interopDefault.js';
import styles from './Hint.module.css';

const Popover = interopDefault(PopoverModule);

/**
 * Пояснение к заголовку блока: над заголовком курсор-«?», при наведении — всплывающее окно Атомаро
 * с тем, что это за блок и зачем он. Текст не занимает место на странице, пока его не попросили.
 * Без text просто возвращает заголовок как есть.
 * placement в Атомаро назван по стороне, куда уходит стрелка: «topRight» — окно над заголовком,
 * начинается от его левого края и тянется вправо; «…Left» тянет окно влево, на левое меню.
 */
export function Hint({ text, placement = 'topRight', children }) {
  if (!text) return children;
  return (
    // className у Popover Атомаро попадает на всплывающее окно, поэтому курсор задаёт своя обёртка.
    <Popover trigger="hover" placement={placement} innerChildren={<span className={styles.text}>{text}</span>}>
      <div className={styles.target}>{children}</div>
    </Popover>
  );
}
