import React, { useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Modal,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTemplateBodyInfo, type Template } from '../../../hooks/useTemplates';

interface TemplatePickerProps {
  visible: boolean;
  onClose: () => void;
  templates: Template[];
  onSend: (templateId: string, params: string[]) => Promise<void>;
  isSending: boolean;
}

export const TemplatePicker: React.FC<TemplatePickerProps> = ({
  visible, onClose, templates, onSend, isSending,
}) => {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Template | null>(null);
  const [params, setParams] = useState<string[]>([]);

  const handleSelect = (template: Template) => {
    const { paramCount } = getTemplateBodyInfo(template);
    setSelected(template);
    setParams(new Array(paramCount).fill(''));
  };

  const handleSend = async () => {
    if (!selected) return;
    await onSend(selected.id, params.filter((p) => p.trim() !== ''));
    setSelected(null);
    setParams([]);
  };

  const handleClose = () => {
    setSelected(null);
    setParams([]);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.header}>
            {selected ? (
              <TouchableOpacity onPress={() => { setSelected(null); setParams([]); }} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={22} color="#363636" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 32 }} />
            )}
            <Text style={styles.title}>{selected ? 'Fill Parameters' : 'Select Template'}</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color="#A6A6A6" />
            </TouchableOpacity>
          </View>

          {!selected ? (
            templates.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="document-outline" size={48} color="#A6A6A6" />
                <Text style={styles.emptyText}>No approved templates available</Text>
              </View>
            ) : (
              <FlatList
                data={templates}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => {
                  const { bodyText, paramCount } = getTemplateBodyInfo(item);
                  return (
                    <TouchableOpacity style={styles.card} onPress={() => handleSelect(item)} activeOpacity={0.7}>
                      <View style={styles.cardTop}>
                        <Text style={styles.cardName}>{item.name}</Text>
                        <View style={[
                          styles.categoryBadge,
                          item.category === 'MARKETING' ? { backgroundColor: '#FFF3E0' }
                            : item.category === 'AUTHENTICATION' ? { backgroundColor: '#F3E5F5' }
                            : { backgroundColor: '#E8F5E9' },
                        ]}>
                          <Text style={[
                            styles.categoryText,
                            item.category === 'MARKETING' ? { color: '#E65100' }
                              : item.category === 'AUTHENTICATION' ? { color: '#7B1FA2' }
                              : { color: '#2E7D32' },
                          ]}>{item.category}</Text>
                        </View>
                      </View>
                      {bodyText ? <Text style={styles.cardBody} numberOfLines={2}>{bodyText}</Text> : null}
                      {paramCount > 0 && (
                        <Text style={styles.paramHint}>{paramCount} parameter{paramCount > 1 ? 's' : ''} required</Text>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )
          ) : (
            <View style={styles.paramView}>
              <View style={styles.previewCard}>
                <Text style={styles.previewLabel}>Template</Text>
                <Text style={styles.previewName}>{selected.name}</Text>
                {(() => {
                  const { bodyText } = getTemplateBodyInfo(selected);
                  if (!bodyText) return null;
                  let preview = bodyText;
                  params.forEach((val, idx) => {
                    if (val.trim()) preview = preview.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), val);
                  });
                  return <Text style={styles.previewBody}>{preview}</Text>;
                })()}
              </View>
              {params.length === 0 ? (
                <Text style={styles.noParams}>This template has no parameters. Tap Send to deliver.</Text>
              ) : (
                params.map((val, idx) => (
                  <View key={idx} style={styles.paramInput}>
                    <Text style={styles.paramLabel}>Parameter {idx + 1}</Text>
                    <TextInput
                      style={styles.paramField}
                      value={val}
                      onChangeText={(text) => { const u = [...params]; u[idx] = text; setParams(u); }}
                      placeholder={`Enter value for {{${idx + 1}}}`}
                      placeholderTextColor="#A6A6A6"
                    />
                  </View>
                ))
              )}
              <TouchableOpacity
                style={[styles.sendBtn, isSending && { opacity: 0.5 }]}
                onPress={handleSend}
                disabled={isSending}
                activeOpacity={0.7}
              >
                {isSending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.sendBtnText}>Send Template</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#EEEEEE' },
  backBtn: { padding: 4 },
  title: { fontSize: 17, fontWeight: '700', color: '#363636' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyText: { marginTop: 12, fontSize: 14, color: '#A6A6A6' },
  card: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#EEEEEE' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#363636', flex: 1 },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginLeft: 8 },
  categoryText: { fontSize: 11, fontWeight: '700' },
  cardBody: { fontSize: 13, color: '#666666', lineHeight: 18 },
  paramHint: { fontSize: 12, color: '#125EF2', marginTop: 6, fontWeight: '600' },
  paramView: { padding: 16 },
  previewCard: { backgroundColor: '#F0F4FF', borderRadius: 12, padding: 14, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#125EF2' },
  previewLabel: { fontSize: 11, color: '#A6A6A6', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  previewName: { fontSize: 15, fontWeight: '700', color: '#125EF2', marginBottom: 8 },
  previewBody: { fontSize: 14, color: '#363636', lineHeight: 20 },
  noParams: { fontSize: 14, color: '#A6A6A6', textAlign: 'center', marginVertical: 16 },
  paramInput: { marginBottom: 14 },
  paramLabel: { fontSize: 13, fontWeight: '600', color: '#363636', marginBottom: 6 },
  paramField: { backgroundColor: '#F8F9FA', borderRadius: 10, borderWidth: 1, borderColor: '#EEEEEE', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#363636' },
  sendBtn: { backgroundColor: '#125EF2', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  sendBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});