// Badge 组件
import { h } from 'vue';

export const Badge = {
  props: ['variant'],
  setup(props: any, { slots }: any) {
    return () => h('span', {
      class: [
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        props.variant === 'default' && 'bg-zinc-800 text-zinc-300',
        props.variant === 'success' && 'bg-green-900/50 text-green-300',
        props.variant === 'warning' && 'bg-amber-900/50 text-amber-300',
        props.variant === 'danger' && 'bg-rose-900/50 text-rose-300',
      ],
    }, slots.default());
  },
};

