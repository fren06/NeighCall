import React from 'react';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { textStyle } from './styles';

type ITextProps = React.ComponentProps<'span'> &
  VariantProps<typeof textStyle> & {
    /** React Native prop; mapped to a CSS line clamp on web. */
    numberOfLines?: number;
  };

const Text = React.forwardRef<React.ComponentRef<'span'>, ITextProps>(
  function Text(
    {
      className,
      isTruncated,
      bold,
      underline,
      strikeThrough,
      size = 'md',
      sub,
      italic,
      highlight,
      numberOfLines,
      style,
      ...props
    }: { className?: string } & ITextProps,
    ref
  ) {
    return (
      <span
        className={textStyle({
          isTruncated: isTruncated as boolean,
          bold: bold as boolean,
          underline: underline as boolean,
          strikeThrough: strikeThrough as boolean,
          size,
          sub: sub as boolean,
          italic: italic as boolean,
          highlight: highlight as boolean,
          class: className,
        })}
        style={
          numberOfLines
            ? {
                display: '-webkit-box',
                WebkitLineClamp: numberOfLines,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                ...style,
              }
            : style
        }
        {...props}
        ref={ref}
      />
    );
  }
);

Text.displayName = 'Text';

export { Text };
