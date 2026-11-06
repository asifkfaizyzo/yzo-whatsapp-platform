import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';

interface AttachMenuProps {
  visible: boolean;
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
  onDocument: () => void;
}

export const AttachMenu: React.FC<AttachMenuProps> = ({
  visible, onClose, onCamera, onGallery, onDocument,
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
      <View style={styles.menu}>
        <TouchableOpacity style={styles.option} onPress={onCamera}>
          <View style={[styles.icon, { backgroundColor: '#E8F0FE' }]}>
            <Ionicons name="camera" size={24} color={colors.primary} />
          </View>
          <Text style={styles.label}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.option} onPress={onGallery}>
          <View style={[styles.icon, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="images" size={24} color="#2E7D32" />
          </View>
          <Text style={styles.label}>Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.option} onPress={onDocument}>
          <View style={[styles.icon, { backgroundColor: '#FFF3E0' }]}>
            <Ionicons name="document" size={24} color="#E65100" />
          </View>
          <Text style={styles.label}>Document</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.option, styles.cancel]} onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menu: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30, paddingTop: 10 },
  option: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, gap: 16 },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  label: { ...typography.body, color: colors.darkGrey },
  cancel: { justifyContent: 'center', marginTop: 8, borderTopWidth: 1, borderTopColor: colors.lightGrey, paddingTop: 20 },
  cancelText: { ...typography.body, color: colors.secondaryGrey, textAlign: 'center', width: '100%' },
});