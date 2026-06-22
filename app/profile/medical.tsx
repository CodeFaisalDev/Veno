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
  TextInput,
  DeviceEventEmitter,
} from 'react-native';
import CustomLoader from '../../components/CustomLoader';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { 
  ArrowLeft, 
  Camera, 
  Image as ImageIcon, 
  ShieldCheck, 
  ShieldWarning, 
  WarningCircle, 
  FileText,
  Calendar,
  Sparkle
} from 'phosphor-react-native';
import { useTheme } from '../../theme';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64(base64: string): ArrayBuffer {
  const cleaned = base64.replace(/=+$/, '');
  const len = cleaned.length;
  const bufferLength = Math.floor(len * 0.75);
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const bytes = new Uint8Array(arrayBuffer);

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const encoded1 = CHARS.indexOf(cleaned[i]);
    const encoded2 = CHARS.indexOf(cleaned[i + 1]);
    const encoded3 = i + 2 < len ? CHARS.indexOf(cleaned[i + 2]) : 0;
    const encoded4 = i + 3 < len ? CHARS.indexOf(cleaned[i + 3]) : 0;

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (i + 2 < len) {
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (i + 3 < len) {
      bytes[p++] = ((encoded3 & 3) << 6) | encoded4;
    }
  }
  return arrayBuffer;
}

interface ExtractedData {
  hemoglobin: number | null;
  weight: number | null;
  last_cbc_date: string | null;
  flagged_conditions: string[];
}

export default function MedicalScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [userGender, setUserGender] = useState<string>('OTHER');
  
  // Scanned health profile fields
  const [hemoglobin, setHemoglobin] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [lastCbcDate, setLastCbcDate] = useState<string>('');
  const [flaggedConditions, setFlaggedConditions] = useState<string[]>([]);
  const [isDataExtracted, setIsDataExtracted] = useState(false);

  useEffect(() => {
    const fetchUserGender = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('gender')
          .eq('id', user.id)
          .single();

        if (profile?.gender) {
          setUserGender(profile.gender);
        }
      } catch (err) {
        console.error('Error fetching gender for eligibility check:', err);
      }
    };

    fetchUserGender();
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
        const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (!cameraPerm.granted) {
          Alert.alert('Permission Denied', 'Camera permissions are required to scan documents.');
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        const libraryPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!libraryPerm.granted) {
          Alert.alert('Permission Denied', 'Gallery access is required to choose documents.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
        setIsDataExtracted(false);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick image file. Please try again.');
    }
  };

  const handleProcessReport = async () => {
    if (!imageUri) return;

    setIsLoading(true);
    setUploadProgress('Compressing report image...');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Session Error', 'You must be logged in to upload documents.');
        setIsLoading(false);
        return;
      }

      // Convert image URI to array buffer
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const arrayBuffer = decodeBase64(base64);

      const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `med_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      setUploadProgress('Uploading to private vault...');
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

      setUploadProgress('AI scanning medical parameters (takes ~15s)...');
      
      const { data, error: functionError } = await supabase.functions.invoke('process-medical-report', {
        body: { documentPath: filePath },
      });

      if (functionError) {
        Alert.alert('Processing Failed', functionError.message || 'Deno server failed to process medical report.');
        setIsLoading(false);
        return;
      }

      if (data.success && data.data) {
        const extracted: ExtractedData = data.data;
        setHemoglobin(extracted.hemoglobin?.toString() || '');
        setWeight(extracted.weight?.toString() || '');
        setLastCbcDate(extracted.last_cbc_date || new Date().toISOString().split('T')[0]);
        setFlaggedConditions(extracted.flagged_conditions || []);
        setIsDataExtracted(true);
        Alert.alert('Scan Completed', 'AI successfully parsed health report variables. Please review values.');
      } else {
        Alert.alert('Extraction Failed', 'Unable to resolve structured data from the document.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An unexpected error occurred during medical scan.');
    } finally {
      setIsLoading(false);
      setUploadProgress('');
    }
  };

  const handleSaveHealthProfile = async () => {
    const parsedHb = parseFloat(hemoglobin);
    const parsedWeight = parseFloat(weight);

    if (isNaN(parsedHb) || parsedHb <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid hemoglobin reading.');
      return;
    }

    if (isNaN(parsedWeight) || parsedWeight <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid weight parameter.');
      return;
    }

    if (!lastCbcDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Validation Error', 'Please enter a date in YYYY-MM-DD format.');
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User session not found.');

      // 1. Save medication profile details
      const { error: medError } = await supabase
        .from('medication_profiles')
        .upsert({
          user_id: user.id,
          hemoglobin: parsedHb,
          weight: parsedWeight,
          last_cbc_date: lastCbcDate,
          flagged_conditions: flaggedConditions,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (medError) throw medError;

      // 2. Validate eligibility state rules
      // Minimum weight: 50 kg
      // Hemoglobin rules: Males >= 13 g/dL, Females >= 12 g/dL, Others >= 12 g/dL
      const isWeightEligible = parsedWeight >= 50;
      const isHbEligible = userGender === 'MALE' ? parsedHb >= 13 : parsedHb >= 12;
      const isHealthFlagEligible = flaggedConditions.length === 0;

      const isEligible = isWeightEligible && isHbEligible && isHealthFlagEligible;

      // 3. Update state in donor_statuses
      const { error: statusError } = await supabase
        .from('donor_statuses')
        .update({
          state: isEligible ? 'ACTIVE' : 'INELIGIBLE',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (statusError) throw statusError;

      Alert.alert(
        isEligible ? 'Profile Saved! (+50 Points)' : 'Profile Updated (Not Eligible)',
        isEligible
          ? 'Your medical report has been registered. You are now ACTIVE and eligible to receive local matches!'
          : 'Your details have been updated. However, you are marked INELIGIBLE based on health donation guidelines.',
        [
          {
            text: 'Acknowledge',
            onPress: () => {
              DeviceEventEmitter.emit('profileUpdated');
              router.replace('/(tabs)');
            }
          }
        ]
      );
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Failed to save health profile.');
    } finally {
      setIsLoading(false);
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

      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} disabled={isLoading}>
          <ArrowLeft size={20} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Medical Report</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <CustomLoader message={`${uploadProgress}\n\nPlease do not lock your screen.`} />
          </View>
        ) : (
          <>
            {!isDataExtracted ? (
              <>
                <View style={styles.introBox}>
                  <FileText size={28} color={theme.colors.brand.default} />
                  <Text style={styles.introTitle}>AI Medical OCR Scanner</Text>
                  <Text style={styles.introDesc}>
                    Upload your CBC or medical report. Veno parses your hemoglobin level and weight parameters to confirm your eligibility automatically.
                  </Text>
                </View>

                {/* File picker */}
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
                      <Text style={styles.placeholderText}>Scan or select medical report file</Text>
                      <Text style={styles.placeholderSubtext}>Supports JPEG or PNG. Ensure metrics are legible.</Text>
                      
                      <View style={styles.captureBtnRow}>
                        <TouchableOpacity style={styles.captureBtn} onPress={() => handlePickImage(true)}>
                          <Camera size={18} color={theme.colors.text.onColor} />
                          <Text style={styles.captureBtnText}>Camera</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.captureBtn, styles.libraryBtn]} onPress={() => handlePickImage(false)}>
                          <ImageIcon size={18} color={theme.colors.text.primary} />
                          <Text style={styles.libraryBtnText}>Gallery</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                {imageUri && (
                  <TouchableOpacity style={styles.actionBtn} onPress={handleProcessReport}>
                    <Sparkle size={18} color={theme.colors.text.onColor} weight="fill" />
                    <Text style={styles.actionBtnText}>START AI REPORT EXTRACTION</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              // Results Form Panel
              <View style={styles.formContainer}>
                <View style={styles.formHeader}>
                  <ShieldCheck size={24} color={theme.colors.status.active} weight="fill" />
                  <Text style={styles.formHeaderTitle}>Scan Results</Text>
                </View>
                <Text style={styles.formHeaderDesc}>
                  We extracted the following metrics. Please confirm their accuracy or adjust them before saving:
                </Text>

                {/* Hemoglobin */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Hemoglobin level (g/dL)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={hemoglobin}
                    onChangeText={setHemoglobin}
                    keyboardType="numeric"
                    placeholder="e.g. 14.5"
                    placeholderTextColor={theme.colors.text.tertiary}
                  />
                  {userGender === 'MALE' ? (
                    <Text style={styles.inputHelp}>Required minimum: 13.0 g/dL for Males</Text>
                  ) : (
                    <Text style={styles.inputHelp}>Required minimum: 12.0 g/dL for Females/Others</Text>
                  )}
                </View>

                {/* Weight */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Weight (kg)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="numeric"
                    placeholder="e.g. 68"
                    placeholderTextColor={theme.colors.text.tertiary}
                  />
                  <Text style={styles.inputHelp}>Required minimum: 50 kg</Text>
                </View>

                {/* Date of Report */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Report Date (YYYY-MM-DD)</Text>
                  <View style={styles.dateInputWrapper}>
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      value={lastCbcDate}
                      onChangeText={setLastCbcDate}
                      placeholder="e.g. 2026-06-21"
                      placeholderTextColor={theme.colors.text.tertiary}
                    />
                    <Calendar size={18} color={theme.colors.text.secondary} style={{ marginRight: 12 }} />
                  </View>
                </View>

                {/* Flagged Conditions */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Infectious / Exclusory Conditions</Text>
                  {flaggedConditions.length > 0 ? (
                    <View style={styles.flaggedList}>
                      {flaggedConditions.map((cond, idx) => (
                        <View key={idx} style={styles.flagBadge}>
                          <WarningCircle size={14} color={theme.colors.status.critical} weight="fill" />
                          <Text style={styles.flagText}>{cond}</Text>
                          <TouchableOpacity 
                            onPress={() => setFlaggedConditions(prev => prev.filter((_, i) => i !== idx))}
                          >
                            <Text style={styles.flagClose}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.noFlagsText}>No exclusory medical conditions flagged.</Text>
                  )}
                </View>

                {/* Warning note if ineligible */}
                {((parseFloat(weight) < 50) || 
                  (userGender === 'MALE' ? parseFloat(hemoglobin) < 13 : parseFloat(hemoglobin) < 12) || 
                  flaggedConditions.length > 0) && (
                  <View style={styles.ineligibleWarning}>
                    <WarningCircle size={18} color={theme.colors.status.critical} weight="fill" />
                    <Text style={styles.ineligibleWarningText}>
                      Based on values, you will be flagged as INELIGIBLE. Please verify entries or consult your physician.
                    </Text>
                  </View>
                )}

                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveHealthProfile}>
                  <Text style={styles.saveBtnText}>SAVE HEALTH PROFILE</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.retryBtn} onPress={() => setIsDataExtracted(false)}>
                  <Text style={styles.retryBtnText}>Scan Again</Text>
                </TouchableOpacity>
              </View>
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
  captureContainer: {
    width: '100%',
    aspectRatio: 1.5,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    borderStyle: 'dashed',
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.bg.surface,
    marginBottom: 24,
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
  },
  captureBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  captureBtn: {
    height: 44,
    paddingHorizontal: 20,
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
    padding: 12,
    justifyContent: 'space-between',
  },
  imagePreview: {
    flex: 1,
    width: '100%',
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
  actionBtn: {
    height: 52,
    backgroundColor: theme.colors.brand.default,
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnText: {
    fontFamily: theme.typography.bodyLg.fontFamily,
    fontSize: 14,
    color: theme.colors.text.onColor,
    letterSpacing: 0.5,
  },
  formContainer: {
    backgroundColor: theme.colors.bg.surface,
    borderRadius: theme.radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  formHeaderTitle: {
    fontFamily: theme.typography.h3.fontFamily,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  formHeaderDesc: {
    fontFamily: theme.typography.bodySm.fontFamily,
    fontSize: 13,
    color: theme.colors.text.secondary,
    lineHeight: 18,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 11,
    color: theme.colors.text.secondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  textInput: {
    height: 48,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 15,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.bg.page,
  },
  inputHelp: {
    fontFamily: theme.typography.bodySm.fontFamily,
    fontSize: 11,
    color: theme.colors.text.tertiary,
    marginTop: 4,
  },
  dateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bg.page,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
  },
  flaggedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  flagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.status.criticalBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    gap: 6,
  },
  flagText: {
    fontFamily: theme.typography.badge.fontFamily,
    fontSize: 11,
    color: theme.colors.status.criticalText,
  },
  flagClose: {
    fontSize: 16,
    color: theme.colors.status.criticalText,
    marginLeft: 4,
    fontWeight: '600',
  },
  noFlagsText: {
    fontFamily: theme.typography.bodySm.fontFamily,
    fontSize: 13,
    color: theme.colors.status.active,
  },
  ineligibleWarning: {
    flexDirection: 'row',
    backgroundColor: theme.colors.status.criticalBg,
    padding: 12,
    borderRadius: theme.radius.md,
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  ineligibleWarningText: {
    flex: 1,
    fontFamily: theme.typography.bodySm.fontFamily,
    fontSize: 12,
    color: theme.colors.status.criticalText,
    lineHeight: 16,
  },
  saveBtn: {
    height: 52,
    backgroundColor: theme.colors.brand.default,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: {
    fontFamily: theme.typography.bodyLg.fontFamily,
    fontSize: 14,
    color: theme.colors.text.onColor,
    letterSpacing: 0.5,
  },
  retryBtn: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  retryBtnText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
});
