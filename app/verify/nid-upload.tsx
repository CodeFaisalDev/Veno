import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Platform,
  StatusBar,
  DeviceEventEmitter,
} from 'react-native';
import CustomLoader from '../../components/CustomLoader';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import * as ImagePicker from 'expo-image-picker';
import { 
  ArrowLeft, 
  Camera, 
  Image as ImageIcon, 
  ShieldCheck, 
  ShieldWarning, 
  WarningCircle, 
  Question 
} from 'phosphor-react-native';
import { useTheme } from '../../theme';

type DocType = 'Bangladesh NID' | 'Passport' | 'Birth Certificate';

export default function NIDUploadScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const [docType, setDocType] = useState<DocType>('Bangladesh NID');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [failureCount, setFailureCount] = useState(0);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status: cameraRollStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (cameraRollStatus !== 'granted' || cameraStatus !== 'granted') {
        Alert.alert(
          'Permissions Required',
          'Veno requires camera and photo library access to capture identity documents.'
        );
      }
    }
  };

  useEffect(() => {
    requestPermissions();
  }, []);

  const handlePickImage = async (useCamera: boolean) => {
    try {
      let result;
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      };

      if (useCamera) {
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleUploadAndVerify = async () => {
    if (!imageUri) {
      Alert.alert('No Document', 'Please capture or select a document image first.');
      return;
    }

    setIsLoading(true);
    setUploadProgress('Preparing file...');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Session Error', 'You must be logged in to upload documents.');
        setIsLoading(false);
        return;
      }

      // Convert image URI to array buffer for upload
      setUploadProgress('Compressing image...');
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();

      const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `doc_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      setUploadProgress('Uploading to secure vault...');
      const { error: uploadError } = await supabase.storage
        .from('identity-documents')
        .upload(filePath, arrayBuffer, {
          contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
          upsert: true,
        });

      if (uploadError) {
        Alert.alert('Upload Failed', uploadError.message);
        setIsLoading(false);
        return;
      }

      setUploadProgress('AI verifying details (takes ~15s)...');
      
      const { data, error: functionError } = await supabase.functions.invoke('process-nid', {
        body: { documentPath: filePath, documentType: docType },
      });

      if (functionError) {
        Alert.alert('Verification Failed', functionError.message || 'The server encountered an error processing your NID.');
        setIsLoading(false);
        return;
      }

      if (data.success) {
        Alert.alert(
          'Identity Verified!',
          'Congratulations! Your identity details have been successfully matched. The Verified Identity badge has been added to your profile.',
          [
            {
              text: 'Acknowledge',
              onPress: () => {
                DeviceEventEmitter.emit('profileUpdated');
                router.replace('/(tabs)');
              },
            },
          ]
        );
      } else {
        const nextFailCount = failureCount + 1;
        setFailureCount(nextFailCount);
        
        let errorMsg = data.message || 'Document verification failed.';
        if (nextFailCount >= 3) {
          Alert.alert(
            'Verification Failed Multiple Times',
            `${errorMsg}\n\nYou have failed verification 3 times. Please contact Veno support for manual account validation.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Contact Support', onPress: () => Alert.alert('Support', 'Support ticket created. A Veno admin will contact you shortly.') }
            ]
          );
        } else {
          Alert.alert(
            'Verification Failed',
            `${errorMsg}\n\nPlease check that the document details exactly match your profile and try again (Attempt ${nextFailCount}/3).`
          );
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An unexpected error occurred during verification.');
    } finally {
      setIsLoading(false);
      setUploadProgress('');
    }
  };

  const styles = getStyles(theme);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar 
        barStyle={theme.dark ? "light-content" : "dark-content"} 
        backgroundColor={theme.colors.bg.page} 
        translucent={false} 
      />
      
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} disabled={isLoading}>
          <ArrowLeft size={20} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify Identity</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <CustomLoader message={`${uploadProgress}\n\nPlease do not close the app.`} />
          </View>
        ) : (
          <>
            <View style={styles.introBox}>
              <ShieldCheck size={28} color={theme.colors.brand.default} />
              <Text style={styles.introTitle}>Secure Document Verification</Text>
              <Text style={styles.introDesc}>
                Veno matches your NID/Passport details against your registered profile. This is completed instantly via secure AI OCR, and your document remains protected in our bank-grade encrypted storage vault.
              </Text>
            </View>

            {/* Document Selector */}
            <Text style={styles.sectionLabel}>Select Document Type</Text>
            <View style={styles.docSelectorRow}>
              {(['Bangladesh NID', 'Passport', 'Birth Certificate'] as DocType[]).map((type) => {
                const isActive = docType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.docTypeCard,
                      isActive && styles.docTypeCardActive
                    ]}
                    onPress={() => setDocType(type)}
                  >
                    <Text 
                      style={[
                        styles.docTypeText,
                        isActive && styles.docTypeTextActive
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Image Preview / Box */}
            <View style={styles.captureContainer}>
              {imageUri ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="contain" />
                  <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImageUri(null)}>
                    <Text style={styles.removeImageText}>Choose Different Image</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.placeholderBox}>
                  <ShieldWarning size={40} color={theme.colors.text.secondary} />
                  <Text style={styles.placeholderText}>Capture front page of your document</Text>
                  <Text style={styles.placeholderSubtext}>Ensure details are fully readable and avoid camera glare.</Text>
                  
                  <View style={styles.captureBtnRow}>
                    <TouchableOpacity style={styles.captureBtn} onPress={() => handlePickImage(true)}>
                      <Camera size={18} color={theme.colors.text.onColor} />
                      <Text style={styles.captureBtnText}>Take Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.captureBtn, styles.libraryBtn]} onPress={() => handlePickImage(false)}>
                      <ImageIcon size={18} color={theme.colors.text.primary} />
                      <Text style={styles.libraryBtnText}>Upload File</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Privacy note */}
            <View style={styles.privacyNotice}>
              <WarningCircle size={14} color={theme.colors.text.secondary} style={{ marginTop: 2 }} />
              <Text style={styles.privacyNoticeText}>
                Your data is stored with AES-256 encryption. We never share your NID details with any third party.
              </Text>
            </View>

            {/* Action Button */}
            {imageUri && (
              <TouchableOpacity style={styles.verifyActionBtn} onPress={handleUploadAndVerify}>
                <Text style={styles.verifyActionBtnText}>SUBMIT FOR VERIFICATION</Text>
              </TouchableOpacity>
            )}

            {failureCount >= 3 && (
              <TouchableOpacity 
                style={styles.supportBtn} 
                onPress={() => Alert.alert('Support', 'A Veno representative will contact you via email or phone within 24 hours.')}
              >
                <Question size={16} color={theme.colors.brand.text} />
                <Text style={styles.supportBtnText}>Request Manual Review</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg.page,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.page,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.bg.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: theme.typography.h2.fontFamily,
    fontSize: 18,
    color: theme.colors.text.primary,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
  loadingText: {
    fontFamily: theme.typography.h3.fontFamily,
    fontSize: 16,
    color: theme.colors.text.primary,
    marginTop: 20,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontFamily: theme.typography.bodySm.fontFamily,
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginTop: 6,
  },
  introBox: {
    backgroundColor: theme.colors.bg.surface,
    borderRadius: theme.radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    alignItems: 'center',
    marginBottom: 24,
  },
  introTitle: {
    fontFamily: theme.typography.h3.fontFamily,
    fontSize: 16,
    color: theme.colors.text.primary,
    marginTop: 10,
    marginBottom: 6,
  },
  introDesc: {
    fontFamily: theme.typography.bodySm.fontFamily,
    fontSize: 13,
    color: theme.colors.text.secondary,
    lineHeight: 18,
    textAlign: 'center',
  },
  sectionLabel: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 12,
    color: theme.colors.text.secondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  docSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  docTypeCard: {
    flex: 1,
    height: 44,
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.bg.surface,
  },
  docTypeCardActive: {
    borderColor: theme.colors.brand.default,
    backgroundColor: theme.colors.brand.subtle,
  },
  docTypeText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 11,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  docTypeTextActive: {
    color: theme.colors.brand.default,
  },
  captureContainer: {
    width: '100%',
    aspectRatio: 1.5,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    borderStyle: 'dashed',
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.bg.surface,
    marginBottom: 16,
    overflow: 'hidden',
  },
  placeholderBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    fontFamily: theme.typography.h3.fontFamily,
    fontSize: 14,
    color: theme.colors.text.primary,
    marginTop: 12,
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontFamily: theme.typography.bodySm.fontFamily,
    fontSize: 12,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
    paddingHorizontal: 16,
  },
  captureBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  captureBtn: {
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.brand.default,
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  captureBtnText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 13,
    color: theme.colors.text.onColor,
  },
  libraryBtn: {
    backgroundColor: theme.colors.bg.surface,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
  },
  libraryBtnText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 13,
    color: theme.colors.text.primary,
  },
  imagePreviewContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    padding: 12,
  },
  imagePreview: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    height: 38,
    backgroundColor: 'rgba(26, 28, 28, 0.8)',
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  removeImageText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 12,
    color: '#FFF',
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 28,
  },
  privacyNoticeText: {
    flex: 1,
    fontFamily: theme.typography.bodySm.fontFamily,
    fontSize: 12,
    color: theme.colors.text.secondary,
    lineHeight: 16,
  },
  verifyActionBtn: {
    height: 52,
    backgroundColor: theme.colors.brand.default,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyActionBtnText: {
    fontFamily: theme.typography.bodyLg.fontFamily,
    fontSize: 15,
    color: theme.colors.text.onColor,
    letterSpacing: 0.5,
  },
  supportBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    padding: 12,
  },
  supportBtnText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 13,
    color: theme.colors.brand.text,
  },
});
