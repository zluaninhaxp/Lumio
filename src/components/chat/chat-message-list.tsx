import { forwardRef, useCallback, useEffect, useImperativeHandle, type Ref } from 'react';
import { FlatList, Platform, StyleSheet, type FlatListProps } from 'react-native';
import Animated, { dispatchCommand, measure, scrollTo, useAnimatedReaction, useAnimatedRef, useAnimatedScrollHandler, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import type { ChatHistoryMessage } from '../../types/chat';

export type ChatScrollController = { followToEnd(): void; stopFollowing(): void; contentDidLayout(width: number, height: number): void };
const visibleContentAnchor = { minIndexForVisible: 0 };
// Scroll worklets need an animated host, not Reanimated's per-cell layout
// renderer. Keep React Native's own cell measurement/virtualization unchanged.
const AnimatedMessageList = Animated.createAnimatedComponent(FlatList<ChatHistoryMessage>);
type Props = Omit<FlatListProps<ChatHistoryMessage>, 'CellRendererComponent'> & { controllerRef: Ref<ChatScrollController> };

export const ChatMessageList = forwardRef<FlatList<ChatHistoryMessage>, Props>((props, ref) => {
  if (Platform.OS === 'android') return <AndroidMessageList {...props} ref={ref} />;
  const { controllerRef: _, ...listProps } = props;
  return <FlatList {...listProps} ref={ref} />;
});

const AndroidMessageList = forwardRef<FlatList<ChatHistoryMessage>, Props>(({ controllerRef, ...props }, ref) => {
  const list = useAnimatedRef<FlatList<ChatHistoryMessage>>();
  const { progress } = useReanimatedKeyboardAnimation();
  const content = useSharedValue(0);
  const viewport = useSharedValue(0);
  const following = useSharedValue(true);
  const dragging = useSharedValue(false);
  const userMomentum = useSharedValue(false);
  const revision = useSharedValue(0);
  const offset = useSharedValue(0);
  const lastTarget = useSharedValue(-1);
  const lastHeight = useSharedValue(0);
  const closingKeyboard = useSharedValue(false);
  const contentAnimation = useSharedValue(false);
  const lastRowWidth = useSharedValue(0);
  const lastRowHeight = useSharedValue(0);
  const lastMessageId = props.data?.[props.data.length - 1]?.id;
  useEffect(() => {
    contentAnimation.value = true;
  }, [lastMessageId, props.ListFooterComponent, contentAnimation]);
  const pixel = StyleSheet.hairlineWidth;
  const reducedMotion = useReducedMotion();
  useImperativeHandle(ref, () => list.current!, [list]);
  useImperativeHandle(controllerRef, () => ({
    followToEnd() { following.value = true; revision.value += 1; },
    stopFollowing() { following.value = false; },
    contentDidLayout(width, height) {
      if (lastRowWidth.value === width && lastRowHeight.value === height) return;
      lastRowWidth.value = width; lastRowHeight.value = height;
      contentAnimation.value = true; revision.value += 1;
    },
  }), [following, revision, contentAnimation, lastRowWidth, lastRowHeight]);

  const onScroll = useAnimatedScrollHandler({
    onBeginDrag() { userMomentum.value = true; dragging.value = true; following.value = false; },
    onScroll(event) {
      offset.value = event.contentOffset.y;
      viewport.value = event.layoutMeasurement.height;
      if (dragging.value) following.value = event.contentSize.height - event.contentOffset.y - event.layoutMeasurement.height <= pixel;
    },
    onEndDrag() { dragging.value = false; },
    onMomentumBegin() { if (userMomentum.value) dragging.value = true; },
    onMomentumEnd() { dragging.value = false; userMomentum.value = false; },
  });
  useAnimatedReaction(
    () => ({ content: content.value, viewport: viewport.value, progress: progress.value, following: following.value, revision: revision.value }),
    (current, previous) => {
      if (previous && current.progress < previous.progress) closingKeyboard.value = true;
      if (previous && current.progress > previous.progress) closingKeyboard.value = false;
      // On dismissal Android already clamps the shrinking scroll range. Keep
      // that existing smooth behavior; reconcile once at the final viewport.
      if (closingKeyboard.value && current.progress > 0) return;
      // Measure the real native viewport during IME movement, without waiting
      // for a JS onLayout/render/two-RAF round trip. No keyboard height math.
      const height = measure(list)?.height ?? current.viewport;
      if (!height || !current.content) return;
      const resized = height !== lastHeight.value;
      lastHeight.value = height;
      if (!current.following || dragging.value) {
        if (previous?.following) scrollTo(list, 0, offset.value, false);
        lastTarget.value = -1;
        return;
      }
      const target = Math.max(0, current.content - height);
      const keyboardMoved = current.progress !== previous?.progress;
      if (Math.abs(target - lastTarget.value) <= pixel) return;
      // Native smooth scroll for message growth; IME resizing follows the
      // platform's own frames instead of starting an independent animation.
      const animate = !!previous && contentAnimation.value && !resized && !keyboardMoved && !closingKeyboard.value && !reducedMotion;
      contentAnimation.value = false;
      if (current.progress === 0) closingKeyboard.value = false;
      lastTarget.value = target;
      userMomentum.value = false;
      // Resolve the boundary on the native ScrollView when the command runs.
      // onContentSizeChange may already describe an obsolete virtual spacer;
      // scrolling to that cached height can move an already settled viewport.
      dispatchCommand(list, 'scrollToEnd', [animate]);
    },
  );
  const onLayout = useCallback<NonNullable<Props['onLayout']>>(event => {
    viewport.value = event.nativeEvent.layout.height;
  }, [viewport]);
  const onContentSizeChange = useCallback((_width: number, height: number) => {
    content.value = height;
  }, [content]);
  return <AnimatedMessageList {...props} ref={list} onScroll={onScroll}
    maintainVisibleContentPosition={visibleContentAnchor}
    onScrollBeginDrag={undefined} onScrollEndDrag={undefined} onMomentumScrollBegin={undefined} onMomentumScrollEnd={undefined}
    onLayout={onLayout} onContentSizeChange={onContentSizeChange} />;
});
