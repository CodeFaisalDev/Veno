import React from 'react';
import { View, Image, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { User } from 'phosphor-react-native';
import { useTheme } from '../theme';

interface AvatarImageProps {
  uri?: string | null;
  size?: number;
  borderWidth?: number;
  borderColor?: string;
  fallbackIconType?: 'user' | 'patient' | 'donor';
  style?: StyleProp<ViewStyle>;
}

export default function AvatarImage({
  uri,
  size = 40,
  borderWidth = 0,
  borderColor,
  fallbackIconType = 'user',
  style,
}: AvatarImageProps) {
  const theme = useTheme();
  
  const finalBorderColor = borderColor || theme.colors.border.subtle;

  const containerStyle = [
    styles.container,
    {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: borderWidth,
      borderColor: finalBorderColor,
      backgroundColor: theme.colors.bg.subtle,
    },
    style,
  ];

  if (uri && uri.trim() !== '') {
    return (
      <View style={containerStyle}>
        <Image
          source={{ uri }}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: size / 2,
          }}
          resizeMode="cover"
        />
      </View>
    );
  }

  // Fallback rendering
  const renderFallbackIcon = () => {
    const iconSize = Math.max(14, size * 0.5);
    const iconColor = theme.colors.text.secondary;

    return <User size={iconSize} color={iconColor} weight="regular" />;
  };

  return (
    <View style={[containerStyle, styles.fallbackContainer]}>
      {renderFallbackIcon()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
