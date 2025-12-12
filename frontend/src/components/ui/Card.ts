// Card 组件
import { h } from 'vue';

export const Card = {
  props: ['padding'],
  setup(props: any, { slots }: any) {
    return () => h('div', {
      class: [
        'bg-zinc-800 rounded-lg border border-zinc-700',
        props.padding === 'none' && 'p-0',
        props.padding === 'sm' && 'p-4',
        props.padding === 'md' && 'p-6',
        props.padding === 'lg' && 'p-8',
        !props.padding && 'p-6',
      ],
    }, slots.default());
  },
};

