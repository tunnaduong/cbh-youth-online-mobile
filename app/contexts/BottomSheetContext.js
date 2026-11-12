import React, { createContext, useCallback, useMemo, useRef, useState, useContext } from "react";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  useBottomSheetSpringConfigs,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SHEET_SPRING, sheetSurfaceStyle, useSheetTokens } from "../components/SheetShell";

const BottomSheetContext = createContext();

export const useBottomSheet = () => useContext(BottomSheetContext);

export const BottomSheetProvider = ({ children }) => {
  const bottomSheetRef = useRef(null);
  const [content, setContent] = useState(null);
  // Whether the sheet is (about to be) open. The backdrop is only mounted
  // while it is: a BottomSheetBackdrop starts with pointerEvents="auto" and
  // relies on a Reanimated reaction to flip it to "none" once it sees the
  // sheet is closed. On some devices (seen on a Redmi Note 15 / Android 16)
  // that first reaction never lands, and the always-mounted, full-screen
  // backdrop then swallowed every touch in the whole app.
  const [isOpen, setIsOpen] = useState(false);
  const tokens = useSheetTokens();
  const insets = useSafeAreaInsets();

  const [customSnapPoints, setCustomSnapPoints] = useState(null);
  const onDismissRef = useRef(null);

  // Both only touch a ref and state setters, so they can be stable - and the
  // value with them: opening or closing the sheet re-renders this provider,
  // which used to re-render every screen that calls useBottomSheet().
  const showBottomSheet = useCallback((sheetContent, options = {}) => {
    onDismissRef.current = options?.onDismiss || null;
    if (options?.snapPoints && Array.isArray(options.snapPoints)) {
      setCustomSnapPoints(options.snapPoints);
    } else {
      setCustomSnapPoints(null);
    }
    setContent(sheetContent);
    setIsOpen(true);
    bottomSheetRef.current?.snapToIndex(0);
  }, []);

  const hideBottomSheet = useCallback(() => {
    bottomSheetRef.current?.close();
    if (onDismissRef.current) {
      onDismissRef.current();
      onDismissRef.current = null;
    }
  }, []);

  const handleSheetChange = useCallback((index) => {
    const open = index >= 0;
    setIsOpen(open);
    if (!open && onDismissRef.current) {
      onDismissRef.current();
      onDismissRef.current = null;
    }
  }, []);

  const handleSheetClose = useCallback(() => {
    setIsOpen(false);
    if (onDismissRef.current) {
      onDismissRef.current();
      onDismissRef.current = null;
    }
  }, []);

  const value = useMemo(() => ({ showBottomSheet, hideBottomSheet }), [showBottomSheet, hideBottomSheet]);

  const sheetBg = tokens.sheetBg;
  const animationConfigs = useBottomSheetSpringConfigs(SHEET_SPRING);

  return (
    <BottomSheetContext.Provider value={value}>
      {children}

      {/* Absolutely positioned BottomSheet to sit above everything */}
      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={customSnapPoints || undefined}
        enableDynamicSizing={!customSnapPoints}
        index={-1}
        enablePanDownToClose
        onChange={handleSheetChange}
        onClose={handleSheetClose}
        animationConfigs={animationConfigs}
        backgroundStyle={sheetSurfaceStyle(tokens)}
        handleIndicatorStyle={{
          backgroundColor: tokens.handle,
          width: 40,
          height: 5,
          borderRadius: 2.5,
        }}
        backdropComponent={
          isOpen
            ? (props) => (
                <BottomSheetBackdrop
                  {...props}
                  opacity={tokens.overlayOpacity}
                  appearsOnIndex={0}
                  disappearsOnIndex={-1}
                  pressBehavior="close"
                />
              )
            : undefined
        }
      >
        <BottomSheetView
          style={{
            paddingHorizontal: 16,
            paddingTop: 6,
            paddingBottom: Math.max(insets.bottom + 18, 28),
            backgroundColor: sheetBg,
          }}
        >
          {content}
        </BottomSheetView>
      </BottomSheet>
    </BottomSheetContext.Provider>
  );
};
