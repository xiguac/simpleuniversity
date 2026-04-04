import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, Text, View } from 'react-native';

const SharedActivityTransitionContext = createContext(null);
const IMAGE_HEADERS = { Referer: 'https://class.pocketuni.net/', 'User-Agent': 'Mozilla/5.0' };
const OPEN_DURATION = 320;

function TransitionImage({ uri, style }) {
  if (Platform.OS === 'web') {
    return <img src={uri} style={{ ...style, objectFit: 'cover' }} referrerPolicy="no-referrer" alt="" />;
  }
  return <Image source={{ uri, headers: IMAGE_HEADERS }} style={style} resizeMode="cover" />;
}

function ActivityCardOverlay({ transition, progress }) {
  const { from, to, item } = transition;
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [from.layout.y, to.layout.y],
  });
  const overlayOpacity = progress.interpolate({
    inputRange: [0, 0.985, 1],
    outputRange: [1, 1, 0],
  });
  const isCompact = from.variant === 'compact';
  const imageSize = isCompact ? 70 : 100;
  const imageRadius = isCompact ? 10 : 15;
  const titleSize = isCompact ? 15 : 16;
  const creditSize = isCompact ? 13 : 12;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.activityCard,
        {
          left: from.layout.x,
          top: 0,
          width: from.layout.width,
          height: from.layout.height,
          opacity: overlayOpacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <TransitionImage uri={item.logo} style={{ width: imageSize, height: imageSize, borderRadius: imageRadius, backgroundColor: '#eef3f1' }} />
      <View style={styles.activityCardContent}>
        <Text style={[styles.activityTitle, { fontSize: titleSize }]} numberOfLines={isCompact ? 1 : 2}>
          {item.name}
        </Text>
        <Text style={[styles.activityCredit, { fontSize: creditSize }]}>+{item.credit} 学分</Text>
        <Text style={styles.activityCount}>{item.sharedCountText}</Text>
      </View>
    </Animated.View>
  );
}

function TribeOverlay({ transition, progress }) {
  const { from, to, item } = transition;
  const hasCard = Boolean(from.card && to.card);
  const cardLeft = hasCard ? progress.interpolate({ inputRange: [0, 1], outputRange: [from.card.x, to.card.x] }) : null;
  const cardTop = hasCard ? progress.interpolate({ inputRange: [0, 1], outputRange: [from.card.y, to.card.y] }) : null;
  const cardWidth = hasCard ? progress.interpolate({ inputRange: [0, 1], outputRange: [from.card.width, to.card.width] }) : null;
  const cardHeight = hasCard ? progress.interpolate({ inputRange: [0, 1], outputRange: [from.card.height, to.card.height] }) : null;
  const cardRadius = hasCard
    ? progress.interpolate({
        inputRange: [0, 1],
        outputRange: [from.card.borderRadius ?? 18, to.card.borderRadius ?? 0],
      })
    : null;
  const logoLeft = progress.interpolate({ inputRange: [0, 1], outputRange: [from.logo.x, to.logo.x] });
  const logoTop = progress.interpolate({ inputRange: [0, 1], outputRange: [from.logo.y, to.logo.y] });
  const logoWidth = progress.interpolate({ inputRange: [0, 1], outputRange: [from.logo.width, to.logo.width] });
  const logoHeight = progress.interpolate({ inputRange: [0, 1], outputRange: [from.logo.height, to.logo.height] });
  const logoRadius = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [from.logo.borderRadius ?? 12, to.logo.borderRadius ?? from.logo.borderRadius ?? 12],
  });
  const nameLeft = progress.interpolate({ inputRange: [0, 1], outputRange: [from.name.x, to.name.x] });
  const nameTop = progress.interpolate({ inputRange: [0, 1], outputRange: [from.name.y, to.name.y] });
  const nameWidth = progress.interpolate({ inputRange: [0, 1], outputRange: [from.name.width, to.name.width] });
  const nameHeight = progress.interpolate({ inputRange: [0, 1], outputRange: [from.name.height, to.name.height] });
  const nameSize = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [from.name.fontSize ?? 16, to.name.fontSize ?? from.name.fontSize ?? 16],
  });
  const overlayOpacity = progress.interpolate({
    inputRange: [0, 0.985, 1],
    outputRange: [1, 1, 0],
  });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}>
      {hasCard ? (
        <Animated.View
          style={[
            styles.tribeCardOverlay,
            {
              left: cardLeft,
              top: cardTop,
              width: cardWidth,
              height: cardHeight,
              borderRadius: cardRadius,
            },
          ]}
        />
      ) : null}
      <Animated.View
        style={[
          styles.tribeLogoWrap,
          {
            left: logoLeft,
            top: logoTop,
            width: logoWidth,
            height: logoHeight,
            borderRadius: logoRadius,
          },
        ]}
      >
        <TransitionImage uri={item.logo} style={styles.tribeLogoImage} />
      </Animated.View>
      <Animated.Text
        numberOfLines={1}
        style={[
          styles.tribeName,
          {
            left: nameLeft,
            top: nameTop,
            width: nameWidth,
            height: nameHeight,
            fontSize: nameSize,
          },
        ]}
      >
        {item.name}
      </Animated.Text>
    </Animated.View>
  );
}

function SharedOverlay({ transition, progress }) {
  if (!transition?.from || !transition?.to) {
    return null;
  }

  if (transition.kind === 'tribe') {
    return <TribeOverlay transition={transition} progress={progress} />;
  }

  return <ActivityCardOverlay transition={transition} progress={progress} />;
}

export function SharedActivityTransitionProvider({ children }) {
  const progress = useRef(new Animated.Value(0)).current;
  const activityReturnProgress = useRef(new Animated.Value(0)).current;
  const tribeReturnProgress = useRef(new Animated.Value(0)).current;
  const activityCacheRef = useRef(new Map());
  const tribeCacheRef = useRef(new Map());
  const [transition, setTransition] = useState(null);
  const [openingActivityId, setOpeningActivityId] = useState(null);
  const [openingTribeId, setOpeningTribeId] = useState(null);
  const [returningActivityId, setReturningActivityId] = useState(null);
  const [returningActivityHeight, setReturningActivityHeight] = useState(0);
  const [returningTribeId, setReturningTribeId] = useState(null);
  const [returningTribeHeight, setReturningTribeHeight] = useState(0);

  const finishTransition = useCallback((kind, id) => {
    setTransition((current) => (current?.kind === kind && current?.id === id ? null : current));
    if (kind === 'activity') {
      setOpeningActivityId((current) => (current === id ? null : current));
    }
    if (kind === 'tribe') {
      const normalized = `${id}`;
      setOpeningTribeId((current) => (`${current}` === normalized ? null : current));
      setReturningTribeId((current) => (`${current}` === normalized ? null : current));
      setReturningTribeHeight(0);
      tribeReturnProgress.setValue(0);
    }
  }, [tribeReturnProgress]);

  const runActivityOpen = useCallback((id, item, from, to) => {
    progress.stopAnimation();
    progress.setValue(0);
    setTransition({ kind: 'activity', id, item, from, to });

    requestAnimationFrame(() => {
      Animated.timing(progress, {
        toValue: 1,
        duration: OPEN_DURATION,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }).start(() => finishTransition('activity', id));
    });
  }, [finishTransition, progress]);

  const runTribeTransition = useCallback((id, item, from, to) => {
    const normalized = `${id}`;
    progress.stopAnimation();
    progress.setValue(0);
    setTransition({ kind: 'tribe', id: normalized, item, from, to });

    requestAnimationFrame(() => {
      Animated.timing(progress, {
        toValue: 1,
        duration: OPEN_DURATION,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }).start(() => finishTransition('tribe', normalized));
    });
  }, [finishTransition, progress]);

  const startActivityTransition = useCallback((item, source) => {
    activityCacheRef.current.set(item.id, { ...(activityCacheRef.current.get(item.id) || {}), source: { ...source, item } });
    setOpeningActivityId(item.id);
    progress.stopAnimation();
    progress.setValue(0);
    setTransition(null);
  }, [progress]);

  const registerActivityTarget = useCallback((activityId, target) => {
    const cached = activityCacheRef.current.get(activityId);
    activityCacheRef.current.set(activityId, { ...cached, target });
    if (!cached?.source) {
      return;
    }
    runActivityOpen(activityId, cached.source.item, cached.source, target);
  }, [runActivityOpen]);

  const beginActivityReturn = useCallback((activityId, currentTarget, onNavigateBack) => {
    const cached = activityCacheRef.current.get(activityId);
    if (!cached?.source) {
      onNavigateBack();
      return;
    }

    progress.stopAnimation();
    progress.setValue(0);
    activityReturnProgress.stopAnimation();
    activityReturnProgress.setValue(0);
    setReturningActivityId(activityId);
    setReturningActivityHeight(cached.source.layout?.height ?? 0);
    setTransition({ kind: 'activity', id: activityId, item: cached.source.item, from: currentTarget, to: cached.source });

    onNavigateBack();

    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(progress, {
          toValue: 1,
          duration: OPEN_DURATION,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.spring(activityReturnProgress, {
          toValue: 1,
          damping: 16,
          stiffness: 170,
          mass: 0.9,
          useNativeDriver: true,
        }),
      ]).start(() => {
        finishTransition('activity', activityId);
        setReturningActivityId((current) => (current === activityId ? null : current));
        setReturningActivityHeight(0);
        activityReturnProgress.setValue(0);
      });
    });
  }, [activityReturnProgress, finishTransition, progress]);

  const isActivityTransitioning = useCallback(
    (activityId) => Boolean(
      openingActivityId === activityId ||
      returningActivityId === activityId ||
      (transition && transition.kind === 'activity' && transition.id === activityId)
    ),
    [openingActivityId, returningActivityId, transition]
  );

  const startTribeTransition = useCallback((item, source) => {
    tribeCacheRef.current.set(item.id, { ...(tribeCacheRef.current.get(item.id) || {}), source: { ...source, item } });
    setOpeningTribeId(`${item.id}`);
    progress.stopAnimation();
    progress.setValue(0);
    setTransition(null);
  }, [progress]);

  const registerTribeTarget = useCallback((tribeId, target) => {
    const normalized = `${tribeId}`;
    const cached = tribeCacheRef.current.get(tribeId);
    tribeCacheRef.current.set(tribeId, { ...cached, target });
    if (!cached?.source) {
      return;
    }
    runTribeTransition(normalized, cached.source.item, cached.source, target);
  }, [runTribeTransition]);

  const beginTribeReturn = useCallback((tribeId, currentTarget, onNavigateBack) => {
    const cached = tribeCacheRef.current.get(tribeId);
    if (!cached?.source) {
      onNavigateBack();
      return;
    }

    const normalized = `${tribeId}`;
    progress.stopAnimation();
    progress.setValue(0);
    tribeReturnProgress.stopAnimation();
    tribeReturnProgress.setValue(0);
    setReturningTribeId(normalized);
    setReturningTribeHeight(cached.source.card?.height ?? 0);
    setTransition({ kind: 'tribe', id: normalized, item: cached.source.item, from: currentTarget, to: cached.source });

    onNavigateBack();

    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(progress, {
          toValue: 1,
          duration: OPEN_DURATION,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.spring(tribeReturnProgress, {
          toValue: 1,
          damping: 16,
          stiffness: 170,
          mass: 0.9,
          useNativeDriver: true,
        }),
      ]).start(() => finishTransition('tribe', normalized));
    });
  }, [finishTransition, progress, tribeReturnProgress]);

  const isTribeTransitioning = useCallback(
    (tribeId) => {
      const normalized = `${tribeId}`;
      return Boolean(
        openingTribeId === normalized ||
        returningTribeId === normalized ||
        (transition && transition.kind === 'tribe' && transition.id === normalized)
      );
    },
    [openingTribeId, returningTribeId, transition]
  );

  const value = useMemo(
    () => ({
      startActivityTransition,
      registerActivityTarget,
      beginActivityReturn,
      isActivityTransitioning,
      returningActivityId,
      returningActivityHeight,
      activityReturnProgress,
      startTribeTransition,
      registerTribeTarget,
      beginTribeReturn,
      isTribeTransitioning,
      returningTribeId,
      returningTribeHeight,
      tribeReturnProgress,
    }),
    [
      activityReturnProgress,
      beginActivityReturn,
      beginTribeReturn,
      isActivityTransitioning,
      isTribeTransitioning,
      registerActivityTarget,
      registerTribeTarget,
      returningActivityHeight,
      returningActivityId,
      returningTribeHeight,
      returningTribeId,
      startActivityTransition,
      startTribeTransition,
      tribeReturnProgress,
    ]
  );

  return (
    <SharedActivityTransitionContext.Provider value={value}>
      {children}
      <SharedOverlay transition={transition} progress={progress} />
    </SharedActivityTransitionContext.Provider>
  );
}

export function useSharedActivityTransition() {
  const context = useContext(SharedActivityTransitionContext);
  if (!context) {
    throw new Error('useSharedActivityTransition must be used inside SharedActivityTransitionProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  activityCard: {
    position: 'absolute',
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 22,
    padding: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  activityCardContent: {
    flex: 1,
    marginLeft: 15,
    justifyContent: 'space-between',
  },
  activityTitle: {
    color: '#2c3e50',
    fontWeight: '700',
  },
  activityCredit: {
    color: '#e67e22',
    fontWeight: '700',
  },
  activityCount: {
    color: '#95a5a6',
    fontSize: 11,
  },
  tribeCardOverlay: {
    position: 'absolute',
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  tribeLogoWrap: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: '#eef3f1',
  },
  tribeLogoImage: {
    width: '100%',
    height: '100%',
  },
  tribeName: {
    position: 'absolute',
    color: '#2c3e50',
    fontWeight: '700',
  },
});
