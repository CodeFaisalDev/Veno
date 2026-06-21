import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MapPin, ShieldWarning } from 'phosphor-react-native';
import { useTheme } from '../theme';

interface StaticMapFallbackProps {
  onClose: () => void;
}

export default function StaticMapFallback({ onClose }: StaticMapFallbackProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.page }]}>
      <View style={[styles.card, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.subtle }]}>
        <View style={[styles.iconContainer, { backgroundColor: theme.colors.brand.default + '15' }]}>
          <MapPin size={48} color={theme.colors.brand.default} weight="duotone" />
        </View>

        <Text style={[styles.title, { 
          fontFamily: theme.typography.h3.fontFamily, 
          color: theme.colors.text.primary 
        }]}>
          Live Map Paused
        </Text>

        <View style={styles.warningContainer}>
          <ShieldWarning size={20} color={theme.colors.brand.default} weight="fill" />
          <Text style={[styles.warningText, { 
            fontFamily: theme.typography.bodySm.fontFamily, 
            color: theme.colors.brand.default 
          }]}>
            Resource Safety Active
          </Text>
        </View>

        <Text style={[styles.description, { 
          fontFamily: theme.typography.body.fontFamily, 
          color: theme.colors.text.secondary 
        }]}>
          To keep Veno free and avoid map API limits, the live map view is temporarily paused. 
          You can close this screen and use the standard location fields, or tap "Use GPS" to resolve your administrative location details.
        </Text>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.colors.brand.default }]} 
          onPress={onClose} 
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, { 
            fontFamily: theme.typography.body.fontFamily, 
            color: theme.colors.text.onColor 
          }]}>
            Return to Manual Location
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 13,
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  button: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
