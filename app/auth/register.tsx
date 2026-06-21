import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, DeviceEventEmitter } from 'react-native';
import CustomLoader from '../../components/CustomLoader';
import { useRouter } from 'expo-router';
import { supabase } from '../../utils/supabase';
import { User, Droplet } from 'lucide-react-native';

// ─── Design Tokens (Precision Minimalism) ─────────────────────
const T = {
  bg: '#FFFFFF',
  surface: '#F9F9F9',
  primary: '#8D151F',
  primaryContainer: '#AE2F34',
  onSurface: '#1A1C1C',
  secondary: '#5F5E5E',
  border: '#E5E5E5',
  accentBg: '#F7F7F7',
  radius: 8,
  radiusFull: 9999,
};

// Bangladesh Location Mapping for 3-tier selector
const LOCATION_DATA: Record<string, Record<string, string[]>> = {
  'Dhaka': {
    'Dhaka': ['Dhaka City', 'Savar', 'Dhamrai', 'Keraniganj'],
    'Narayanganj': ['Narayanganj City', 'Araihazar', 'Bandar', 'Rupganj', 'Sonargaon'],
    'Gazipur': ['Gazipur City', 'Kaliakair', 'Kaliganj', 'Kapasia', 'Sreepur'],
  },
  'Chattogram': {
    'Chattogram': ['Chattogram City', 'Hathazari', 'Mirsharai', 'Patiya', 'Raozan'],
    'Cox\'s Bazar': ['Cox\'s Bazar', 'Ukhiya', 'Teknaf', 'Ramu', 'Maheshkhali'],
    'Comilla': ['Comilla City', 'Barura', 'Chandina', 'Chauddagram', 'Laksam'],
  },
  'Rajshahi': {
    'Rajshahi': ['Rajshahi City', 'Bagha', 'Bagmara', 'Charghat', 'Puthia'],
    'Bogura': ['Bogura City', 'Adamdighi', 'Dhunat', 'Gabtali', 'Sherpur'],
  },
  'Khulna': {
    'Khulna': ['Khulna City', 'Batiaghata', 'Dacope', 'Dumuria', 'Rupa'],
    'Jashore': ['Jashore City', 'Abhaynagar', 'Bagherpara', 'Chougachha', 'Jhikargachha'],
  },
};

export default function RegisterScreen() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Step 1: Personal Info
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | ''>('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');

  // Step 2: Blood Group
  const [bloodGroup, setBloodGroup] = useState('');

  // Step 3: Location
  const [division, setDivision] = useState('');
  const [district, setDistrict] = useState('');
  const [upazila, setUpazila] = useState('');

  // Dropdown list states
  const [districtsList, setDistrictsList] = useState<string[]>([]);
  const [upazilasList, setUpazilasList] = useState<string[]>([]);

  // Update districts list when division changes
  useEffect(() => {
    if (division && LOCATION_DATA[division]) {
      setDistrictsList(Object.keys(LOCATION_DATA[division]));
      setDistrict('');
      setUpazila('');
    } else {
      setDistrictsList([]);
    }
  }, [division]);

  // Update upazilas list when district changes
  useEffect(() => {
    if (division && district && LOCATION_DATA[division][district]) {
      setUpazilasList(LOCATION_DATA[division][district]);
      setUpazila('');
    } else {
      setUpazilasList([]);
    }
  }, [district]);

  const validateStep1 = () => {
    if (fullName.trim().length < 3) {
      Alert.alert('Validation Error', 'Full name must be at least 3 characters.');
      return false;
    }
    if (!gender) {
      Alert.alert('Validation Error', 'Please select your gender.');
      return false;
    }

    const day = parseInt(dobDay, 10);
    const month = parseInt(dobMonth, 10);
    const year = parseInt(dobYear, 10);

    if (isNaN(day) || day < 1 || day > 31 || isNaN(month) || month < 1 || month > 12 || isNaN(year) || year < 1920 || year > new Date().getFullYear()) {
      Alert.alert('Validation Error', 'Please enter a valid Date of Birth (DD/MM/YYYY).');
      return false;
    }

    // Verify age >= 18
    const dob = new Date(year, month - 1, day);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    if (age < 18) {
      Alert.alert('Age Restriction', 'You must be at least 18 years old to join as a blood donor.');
      return false;
    }

    return true;
  };

  const validateStep2 = () => {
    if (!bloodGroup) {
      Alert.alert('Validation Error', 'Please select your blood group.');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!division || !district || !upazila) {
      Alert.alert('Validation Error', 'Please complete all location fields.');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1) {
      if (validateStep1()) setStep(2);
    } else if (step === 2) {
      if (validateStep2()) setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleRegister = async () => {
    if (!validateStep3()) return;

    setIsLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        Alert.alert('Error', 'Session not found. Please log in again.');
        router.replace('/auth/login');
        return;
      }

      const formattedDob = `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`;

      // Update public.profiles
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          date_of_birth: formattedDob,
          blood_group: bloodGroup,
          gender: gender,
          division: division,
          district: district,
          upazila: upazila,
        })
        .eq('id', user.id);

      if (updateError) {
        Alert.alert('Registration Failed', updateError.message);
        return;
      }

      // Automatically register user's initial active state in donor_statuses
      await supabase
        .from('donor_statuses')
        .update({ state: 'ACTIVE' })
        .eq('user_id', user.id);

      // Notify RootLayout that profile setup is complete
      DeviceEventEmitter.emit('profileUpdated');
    } catch (err) {
      Alert.alert('Error', 'An unexpected error occurred during registration.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={s.container}
    >
      <ScrollView contentContainerStyle={s.scrollContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Step Indicator */}
        <View style={s.indicatorContainer}>
          <Text style={s.indicatorTitle}>Register</Text>
          <Text style={s.indicatorSubtitle}>STEP {step} OF 3</Text>
          <View style={s.progressBar}>
            <View style={[s.progressActive, { width: `${(step / 3) * 100}%` }]} />
          </View>
        </View>

        {step === 1 && (
          <View style={s.card}>
            <Text style={s.cardHeader}>Personal Information</Text>
            <Text style={s.cardDescription}>
              Please enter your legal name and date of birth as written on your NID.
            </Text>

            <View style={s.inputContainer}>
              <User size={18} color={T.secondary} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="Full Name (e.g., Faisal Sorkar)"
                placeholderTextColor="#A0A0A0"
                value={fullName}
                onChangeText={setFullName}
                editable={!isLoading}
              />
            </View>

            <Text style={s.label}>Gender</Text>
            <View style={s.genderContainer}>
              {(['MALE', 'FEMALE', 'OTHER'] as const).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[s.genderButton, gender === g && s.genderButtonActive]}
                  onPress={() => setGender(g)}
                  disabled={isLoading}
                >
                  <Text style={[s.genderText, gender === g && s.genderTextActive]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Date of Birth</Text>
            <View style={s.dobContainer}>
              <TextInput
                style={[s.dobInput, { flex: 1.5 }]}
                placeholder="DD"
                placeholderTextColor="#A0A0A0"
                keyboardType="number-pad"
                maxLength={2}
                value={dobDay}
                onChangeText={setDobDay}
                editable={!isLoading}
                textAlign="center"
              />
              <Text style={s.dobSlash}>/</Text>
              <TextInput
                style={[s.dobInput, { flex: 1.5 }]}
                placeholder="MM"
                placeholderTextColor="#A0A0A0"
                keyboardType="number-pad"
                maxLength={2}
                value={dobMonth}
                onChangeText={setDobMonth}
                editable={!isLoading}
                textAlign="center"
              />
              <Text style={s.dobSlash}>/</Text>
              <TextInput
                style={[s.dobInput, { flex: 2.5 }]}
                placeholder="YYYY"
                placeholderTextColor="#A0A0A0"
                keyboardType="number-pad"
                maxLength={4}
                value={dobYear}
                onChangeText={setDobYear}
                editable={!isLoading}
                textAlign="center"
              />
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={s.card}>
            <Text style={s.cardHeader}>Blood Group</Text>
            <Text style={s.cardDescription}>
              Select your blood group. This is critical for matching you with requests nearby.
            </Text>

            <View style={s.bloodGrid}>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => (
                <TouchableOpacity
                  key={group}
                  style={[s.bloodCard, bloodGroup === group && s.bloodCardActive]}
                  onPress={() => setBloodGroup(group)}
                  disabled={isLoading}
                >
                  <Droplet
                    size={24}
                    color={bloodGroup === group ? '#FFF' : T.primaryContainer}
                    fill={bloodGroup === group ? '#FFF' : 'transparent'}
                    style={{ marginBottom: 6 }}
                  />
                  <Text style={[s.bloodText, bloodGroup === group && s.bloodTextActive]}>
                    {group}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={s.card}>
            <Text style={s.cardHeader}>Select Location</Text>
            <Text style={s.cardDescription}>
              Enter your active location to receive donation alerts matching your area.
            </Text>

            {/* Division Selector */}
            <Text style={s.label}>Division</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.listScroll}>
              {Object.keys(LOCATION_DATA).map((div) => (
                <TouchableOpacity
                  key={div}
                  style={[s.selectPill, division === div && s.selectPillActive]}
                  onPress={() => setDivision(div)}
                  disabled={isLoading}
                >
                  <Text style={[s.selectPillText, division === div && s.selectPillTextActive]}>
                    {div}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* District Selector */}
            {division ? (
              <>
                <Text style={s.label}>District</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.listScroll}>
                  {districtsList.map((dist) => (
                    <TouchableOpacity
                      key={dist}
                      style={[s.selectPill, district === dist && s.selectPillActive]}
                      onPress={() => setDistrict(dist)}
                      disabled={isLoading}
                    >
                      <Text style={[s.selectPillText, district === dist && s.selectPillTextActive]}>
                        {dist}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : null}

            {/* Upazila Selector */}
            {district ? (
              <>
                <Text style={s.label}>Upazila / Area</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.listScroll}>
                  {upazilasList.map((upz) => (
                    <TouchableOpacity
                      key={upz}
                      style={[s.selectPill, upazila === upz && s.selectPillActive]}
                      onPress={() => setUpazila(upz)}
                      disabled={isLoading}
                    >
                      <Text style={[s.selectPillText, upazila === upz && s.selectPillTextActive]}>
                        {upz}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : null}
          </View>
        )}

        {/* Action Buttons */}
        <View style={s.buttonRow}>
          {step > 1 && (
            <TouchableOpacity
              style={s.backActionButton}
              onPress={handleBack}
              disabled={isLoading}
            >
              <Text style={s.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}

          {step < 3 ? (
            <TouchableOpacity
              style={[s.nextActionButton, step === 1 && { width: '100%' }]}
              onPress={handleNext}
              disabled={isLoading}
            >
              <Text style={s.nextButtonText}>Next Step</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={s.nextActionButton}
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <CustomLoader size="small" color="#FFFFFF" />
              ) : (
                <Text style={s.nextButtonText}>Complete Registration</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bg,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 64 : 44,
    justifyContent: 'center',
  },
  indicatorContainer: {
    marginBottom: 28,
  },
  indicatorTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: T.onSurface,
    letterSpacing: -0.5,
  },
  indicatorSubtitle: {
    fontSize: 12,
    color: T.secondary,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: T.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 12,
  },
  progressActive: {
    height: '100%',
    backgroundColor: T.primaryContainer,
    borderRadius: 2,
  },
  card: {
    backgroundColor: T.bg,
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: T.border,
    minHeight: 320,
    justifyContent: 'center',
  },
  cardHeader: {
    fontSize: 24,
    fontWeight: '700',
    color: T.onSurface,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  cardDescription: {
    fontSize: 14,
    color: T.secondary,
    lineHeight: 20,
    marginBottom: 24,
    fontWeight: '400',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: T.onSurface,
    marginTop: 20,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: T.radius,
    paddingHorizontal: 16,
    height: 52,
    backgroundColor: T.bg,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: T.onSurface,
    fontWeight: '500',
  },
  genderContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  genderButton: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: T.radius,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: T.bg,
  },
  genderButtonActive: {
    borderColor: T.primaryContainer,
    backgroundColor: '#FFDAD8',
  },
  genderText: {
    fontSize: 13,
    color: T.secondary,
    fontWeight: '600',
  },
  genderTextActive: {
    color: T.primary,
  },
  dobContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dobInput: {
    height: 52,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: T.radius,
    fontSize: 16,
    color: T.onSurface,
    backgroundColor: T.bg,
    fontWeight: '600',
  },
  dobSlash: {
    fontSize: 20,
    color: T.border,
    fontWeight: 'bold',
  },
  bloodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  bloodCard: {
    width: '22%',
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: T.radius,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: T.bg,
  },
  bloodCardActive: {
    borderColor: T.primaryContainer,
    backgroundColor: T.primaryContainer,
  },
  bloodText: {
    fontSize: 15,
    fontWeight: '700',
    color: T.onSurface,
  },
  bloodTextActive: {
    color: '#FFF',
  },
  listScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  selectPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: T.radiusFull,
    marginRight: 8,
    backgroundColor: T.bg,
  },
  selectPillActive: {
    borderColor: T.primaryContainer,
    backgroundColor: '#FFDAD8',
  },
  selectPillText: {
    fontSize: 13,
    color: T.secondary,
    fontWeight: '600',
  },
  selectPillTextActive: {
    color: T.primary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
  },
  backActionButton: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderColor: T.onSurface,
    borderRadius: T.radiusFull,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: T.bg,
  },
  backButtonText: {
    fontSize: 15,
    color: T.onSurface,
    fontWeight: '600',
  },
  nextActionButton: {
    flex: 2,
    height: 52,
    backgroundColor: T.primaryContainer,
    borderRadius: T.radiusFull,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '600',
  },
});
