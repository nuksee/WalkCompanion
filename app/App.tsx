import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WalkScreen } from './src/screens/WalkScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <WalkScreen />
    </SafeAreaProvider>
  );
}
