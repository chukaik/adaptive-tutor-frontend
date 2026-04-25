import { Platform } from 'react-native';

// Apply to ScrollView's style prop on web to enable scrolling
export const webScrollStyle = Platform.OS === 'web'
  ? { height: '100vh', overflow: 'auto' }
  : {};

// Apply to ScrollView's contentContainerStyle on all platforms
export const scrollContentStyle = {
  flexGrow: 1,
};

export const webFlatListStyle =
  Platform.OS === 'web'
    ? {
        flex: 1,
        overflow: 'auto',
        height: '100%',
      }
    : { flex: 1 };



    // import { Platform } from 'react-native';
    
    // // Apply to the ROOT container View of any screen that needs web scrolling
    // export const webRootStyle = Platform.OS === 'web'
    //   ? { minHeight: '100vh', display: 'flex', flexDirection: 'column' }
    //   : {};
    
    // // Apply to ScrollView's style prop
    // export const webScrollStyle = Platform.OS === 'web'
    //   ? { flex: 1, overflow: 'auto' }
    //   : { flex: 1 };
    
    // // Apply to ScrollView's contentContainerStyle
    // export const scrollContentStyle = {
    //   flexGrow: 1,
    // };
    
    // // Apply to FlatList's style prop
    // export const webFlatListStyle = Platform.OS === 'web'
    //   ? { flex: 1, overflow: 'auto' }
    //   : { flex: 1 };
    