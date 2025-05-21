import React, { createContext, useRef, useState, useContext } from "react";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";

const BottomSheetContext = createContext();

export const useBottomSheet = () => useContext(BottomSheetContext);

export const BottomSheetProvider = ({ children }) => {
  const bottomSheetRef = useRef(null);
  const [content, setContent] = useState(null);

  const snapPoints = ["90%"];

  const showBottomSheet = (sheetContent) => {
    setContent(sheetContent);
    bottomSheetRef.current?.snapToIndex(0);
  };

  const hideBottomSheet = () => {
    bottomSheetRef.current?.close();
  };

  return (
    <BottomSheetContext.Provider value={{ showBottomSheet, hideBottomSheet }}>
      {children}

      {/* Absolutely positioned BottomSheet to sit above everything */}
      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        index={-1}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: "#fff" }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
            pressBehavior="close"
          />
        )}
      >
        <BottomSheetView style={{ padding: 16, paddingBottom: 50 }}>
          {content}
        </BottomSheetView>
      </BottomSheet>
    </BottomSheetContext.Provider>
  );
};
