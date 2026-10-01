import { forwardRef, ReactNode, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, Text, useWindowDimensions } from 'react-native';

import { colors, radius } from '@/constants/theme';

export type SwipeDirection = 'left' | 'right';
export type SwipeCardHandle = { swipe: (direction: SwipeDirection) => void };

type Props = {
  children: ReactNode;
  disabled?: boolean;
  onSwiped: (direction: SwipeDirection) => void;
};

const NATIVE = Platform.OS !== 'web';
const webStyle = Platform.OS === 'web' ? ({ userSelect: 'none', touchAction: 'pan-y' } as object) : null;

export const SwipeCard = forwardRef<SwipeCardHandle, Props>(function SwipeCard(
  { children, disabled = false, onSwiped },
  ref
) {
  const { width } = useWindowDimensions();
  const position = useRef(new Animated.Value(0)).current;
  const swipedRef = useRef(false);
  const onSwipedRef = useRef(onSwiped);
  const disabledRef = useRef(disabled);
  onSwipedRef.current = onSwiped;
  disabledRef.current = disabled;

  const threshold = Math.min(width, 560) * 0.27;
  const flyDistance = width * 1.3;

  const fling = useCallback(
    (direction: SwipeDirection) => {
      if (swipedRef.current) return;
      swipedRef.current = true;
      Animated.timing(position, {
        toValue: direction === 'right' ? flyDistance : -flyDistance,
        duration: 220,
        useNativeDriver: NATIVE,
      }).start(() => onSwipedRef.current(direction));
    },
    [position, flyDistance]
  );

  const reset = useCallback(() => {
    Animated.spring(position, { toValue: 0, friction: 6, useNativeDriver: NATIVE }).start();
  }, [position]);

  useImperativeHandle(ref, () => ({ swipe: fling }), [fling]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          !disabledRef.current &&
          !swipedRef.current &&
          Math.abs(gesture.dx) > 12 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, gesture) => position.setValue(gesture.dx),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > threshold || (gesture.vx > 0.5 && gesture.dx > 20)) fling('right');
          else if (gesture.dx < -threshold || (gesture.vx < -0.5 && gesture.dx < -20)) fling('left');
          else reset();
        },
        onPanResponderTerminate: reset,
      }),
    [fling, reset, position, threshold]
  );

  const rotate = position.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ['-12deg', '0deg', '12deg'],
    extrapolate: 'clamp',
  });
  const catchOpacity = position.interpolate({
    inputRange: [0, threshold],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const swerveOpacity = position.interpolate({
    inputRange: [-threshold, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[styles.card, webStyle, { transform: [{ translateX: position }, { rotate }] }]}
    >
      {children}
      <Animated.View style={[styles.stamp, styles.catchStamp, { opacity: catchOpacity }]}>
        <Text style={[styles.stampText, { color: colors.success }]}>CATCH ❤️</Text>
      </Animated.View>
      <Animated.View style={[styles.stamp, styles.swerveStamp, { opacity: swerveOpacity }]}>
        <Text style={[styles.stampText, { color: colors.danger }]}>SWERVE ✕</Text>
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: { width: '100%' },
  stamp: {
    position: 'absolute',
    top: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 3,
    backgroundColor: 'rgba(15,23,42,0.55)',
    pointerEvents: 'none',
  },
  catchStamp: { left: 18, borderColor: colors.success, transform: [{ rotate: '-12deg' }] },
  swerveStamp: { right: 18, borderColor: colors.danger, transform: [{ rotate: '12deg' }] },
  stampText: { fontSize: 20, fontWeight: '900', letterSpacing: 1 },
});