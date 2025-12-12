// Button 组件
import { h } from 'vue';

export const Button = {
  props: ['variant', 'size', 'disabled'],
  emits: ['click'],
  setup(props: any, { emit, slots }: any) {
    return () => h('button', {
      class: [
        'px-4 py-2 rounded-lg font-medium transition-colors',
        props.variant === 'primary' && 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100',
        props.variant === 'secondary' && 'bg-zinc-700 hover:bg-zinc-600 text-zinc-100',
        props.variant === 'ghost' && 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100',
        props.size === 'sm' && 'px-3 py-1.5 text-sm',
        props.size === 'lg' && 'px-6 py-3 text-lg',
        props.disabled && 'opacity-50 cursor-not-allowed',
      ],
      disabled: props.disabled,
      onClick: (e) => emit('click', e),
    }, slots.default());
  },
};

