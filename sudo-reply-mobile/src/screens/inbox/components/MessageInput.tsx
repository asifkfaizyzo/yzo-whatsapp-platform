import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MessageInputProps {
  message: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onAttach: () => void;
  onTemplate: () => void;
  isSending: boolean;
  canSend: boolean;
  hasPendingMedia: boolean;
  hasQuickReply: boolean;
  bottomInset: number;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  message,
  onChangeText,
  onSend,
  onAttach,
  onTemplate,
  isSending,
  canSend,
  hasPendingMedia,
  hasQuickReply,
  bottomInset,
}) => {
  const showExtras = !hasPendingMedia && !hasQuickReply;

  return (
    <View style={[styles.inputBar, { paddingBottom: Math.max(bottomInset, 8) }]}>
      
      {/* Attachments & Templates */}
      {showExtras && (
        <View style={styles.actionsLeft}>
          <TouchableOpacity style={styles.iconButton} onPress={onAttach} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Ionicons name="add-outline" size={26} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={onTemplate} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Ionicons name="document-text-outline" size={22} color="#6B7280" />
          </TouchableOpacity>
        </View>
      )}

      {/* Input Field */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder={
            hasPendingMedia ? 'Add a caption...' : hasQuickReply ? 'Edit message...' : 'Type a message...'
          }
          placeholderTextColor="#9CA3AF"
          value={message}
          onChangeText={onChangeText}
          multiline
          maxLength={4096}
        />
      </View>

      {/* Send Button */}
      <TouchableOpacity
        style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
        onPress={onSend}
        disabled={!canSend || isSending}
      >
        {isSending ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Ionicons name="send" size={14} color="#FFFFFF" style={{ marginLeft: 2 }} />
        )}
      </TouchableOpacity>

    </View>
  );
};

const styles = StyleSheet.create({
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  actionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  iconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    flex: 1,
    backgroundColor: '#F0F1F3',
    borderRadius: 20,
    minHeight: 40,
    maxHeight: 120,
    marginHorizontal: 6,
    marginBottom: 4,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 14, // <--- Updated from 11px to 14px
    color: '#111827',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    margin: 0,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3B82F6', // Crisp primary blue
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6, // Centers exactly with the text input
  },
  sendButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
});