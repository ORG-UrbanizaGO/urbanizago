import Svg, { Path } from 'react-native-svg';
import { paths, medalColor, type IconProps } from './paths';
export type { IconName, IconProps } from './paths';
export function Icon({ name, size = 24, color, label }: IconProps) {
    return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? medalColor(name) ?? '#142333'} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" accessible={Boolean(label)} accessibilityLabel={label}>
    {paths[name].map((d, index) => <Path key={index} d={d}/>)}
  </Svg>;
}
export function Logo({ size = 36 }: {
    size?: number;
}) {
    return <Svg width={size} height={size} viewBox="0 0 40 40" accessible accessibilityLabel="UrbanizaGO">
    <Path fill="#108357" d="M20 1a17 17 0 0 0-17 17c0 9 17 21 17 21s17-12 17-21A17 17 0 0 0 20 1Z"/>
    <Path fill="white" d="M20 5a12 12 0 1 0 0 24 12 12 0 0 0 0-24Z"/>
    <Path fill="#108357" d="M11 20v-4l3-4 3 4v4h-2v5h-2v-5Zm8 5V9h4v16Zm6 0v-8h3v8Z"/>
  </Svg>;
}

