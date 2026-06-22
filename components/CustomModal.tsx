import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Modal } from 'react-native';
import Animated, { 
  FadeIn, 
  FadeOut, 
  SlideInDown, 
  SlideOutDown 
} from 'react-native-reanimated';
import { 
  CheckCircle, 
  WarningCircle, 
  Info, 
  X, 
  Question
} from 'phosphor-react-native';
import { useTheme } from '../theme';

interface CustomModalProps {
  visible: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  type?: 'success' | 'warning' | 'danger' | 'info' | 'question';
}

export default function CustomModal({
  visible,
  title,
  description,
  confirmText = 'OK',
  cancelText,
  onConfirm,
  onCancel,
  type = 'info',
}: CustomModalProps) {
  const theme = useTheme();

  if (!visible) return null;

  // Semantic mappings
  const getHeaderIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={32} color={theme.colors.status.active} weight="fill" />;
      case 'warning':
      case 'danger':
        return <WarningCircle size={32} color={theme.colors.status.critical} weight="fill" />;
      case 'info':
        return <Info size={32} color={theme.colors.brand.default} weight="fill" />;
      case 'question':
        return <Question size={32} color={theme.colors.status.pending} weight="fill" />;
      default:
        return <Info size={32} color={theme.colors.brand.default} weight="fill" />;
    }
  };

  const getHeaderBg = () => {
    switch (type) {
      case 'success':
        return theme.colors.status.activeBg;
      case 'warning':
      case 'danger':
        return theme.colors.status.criticalBg;
      case 'info':
        return theme.colors.brand.subtle;
      case 'question':
        return theme.colors.status.pendingBg;
      default:
        return theme.colors.brand.subtle;
    }
  };

  const isDestructive = type === 'danger' || type === 'warning';

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onCancel || onConfirm}
    >
      <View style={styles.outerContainer}>
        {/* Animated semi-transparent backdrop */}
        <Animated.View 
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[styles.backdrop, { backgroundColor: theme.colors.bg.overlay }]}
        >
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={onCancel || (() => {})} 
          />
        </Animated.View>

        {/* Modal content container */}
        <Animated.View 
          entering={SlideInDown.springify().damping(20).stiffness(140)}
          exiting={SlideOutDown.duration(200)}
          style={[
            styles.modalContainer, 
            { 
              backgroundColor: theme.colors.bg.surfaceRaised,
              borderColor: theme.colors.border.subtle,
              borderRadius: theme.radius.lg,
              ...theme.shadows.elevation3
            }
          ]}
        >
          {/* Header Icon badge */}
          <View style={styles.headerIconWrapper}>
            <View style={[styles.iconCircle, { backgroundColor: getHeaderBg() }]}>
              {getHeaderIcon()}
            </View>
          </View>

          {/* Text contents */}
          <View style={styles.bodyContent}>
            <Text style={[
              styles.titleText, 
              { 
                fontFamily: theme.typography.h2.fontFamily, 
                color: theme.colors.text.primary 
              }
            ]}>
              {title}
            </Text>
            
            <Text style={[
              styles.descText, 
              { 
                fontFamily: theme.typography.body.fontFamily, 
                color: theme.colors.text.secondary 
              }
            ]}>
              {description}
            </Text>
          </View>

          {/* Action buttons footer */}
          <View style={[styles.actionsRow, { borderTopColor: theme.colors.border.subtle }]}>
            {cancelText && onCancel && (
              <TouchableOpacity 
                style={[
                  styles.btn, 
                  styles.cancelBtn,
                  { borderColor: theme.colors.border.strong, borderRadius: theme.radius.md }
                ]}
                onPress={onCancel}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.cancelBtnText, 
                  { 
                    fontFamily: theme.typography.body.fontFamily, 
                    color: theme.colors.text.primary 
                  }
                ]}>
                  {cancelText}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={[
                styles.btn, 
                isDestructive ? styles.confirmBtnDestructive : styles.confirmBtn,
                { 
                  backgroundColor: isDestructive ? theme.colors.status.critical : theme.colors.brand.default,
                  borderRadius: theme.radius.md 
                }
              ]}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.confirmBtnText, 
                { 
                  fontFamily: theme.typography.bodyLg.fontFamily, 
                  color: theme.colors.text.onColor,
                  fontWeight: '600'
                }
              ]}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    paddingTop: 24,
    zIndex: 1,
  },
  headerIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bodyContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  descText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  actionsRow: {
    width: '100%',
    flexDirection: 'row',
    borderTopWidth: 1,
    padding: 12,
    gap: 8,
  },
  btn: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
  confirmBtn: {},
  confirmBtnDestructive: {},
  confirmBtnText: {
    fontSize: 14,
  },
});
