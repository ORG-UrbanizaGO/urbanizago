import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { NativeRoot } from '@urbanizago/app-ui/native';
import { CitizenApp } from '@urbanizago/app-ui/citizen';
type Routes = {
    Screen: {
        page: string;
    };
};
const Stack = createNativeStackNavigator<Routes>();
function Screen({ route, navigation }: NativeStackScreenProps<Routes, 'Screen'>) { return <CitizenApp page={route.params.page} onPage={page => navigation.push('Screen', { page })}/>; }
export default function App() { return <NativeRoot role="CITIZEN"><NavigationContainer><Stack.Navigator screenOptions={{ headerShown: false }}><Stack.Screen name="Screen" component={Screen} initialParams={{ page: 'home' }}/></Stack.Navigator></NavigationContainer></NativeRoot>; }

