import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Switch,
} from 'react-native';
import { colors } from '../utils/theme';
import type { WatchlistItem } from '../types';

interface WatchlistCardProps {
  item: WatchlistItem;
  onSelect: (symbol: string) => void;
  onRemove: (symbol: string) => void;
  onUpdateNotes: (symbol: string, notes: string) => void;
  onSetAlert: (symbol: string, alertPrice?: number, alertType?: 'above' | 'below', alertEnabled?: boolean) => void;
}

export const WatchlistCard: React.FC<WatchlistCardProps> = ({
  item,
  onSelect,
  onRemove,
  onUpdateNotes,
  onSetAlert,
}) => {
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notes, setNotes] = useState(item.notes || '');
  const [alertPriceInput, setAlertPriceInput] = useState(item.alertPrice?.toString() || '');
  const [alertType, setAlertType] = useState<'above' | 'below'>(item.alertType || 'above');

  const price = item.currentPrice || item.analysis?.quote?.regularMarketPrice || 0;
  const change = item.changePercent || item.analysis?.quote?.regularMarketChangePercent || 0;
  const isPositive = change >= 0;

  const handleSaveNotes = () => {
    onUpdateNotes(item.symbol, notes);
    setShowNotesModal(false);
  };

  const handleSaveAlert = () => {
    const price = parseFloat(alertPriceInput);
    if (!isNaN(price) && price > 0) {
      onSetAlert(item.symbol, price, alertType, true);
    }
    setShowAlertModal(false);
  };

  const handleToggleAlert = (value: boolean) => {
    onSetAlert(item.symbol, item.alertPrice, item.alertType, value);
  };

  return (
    <>
      <TouchableOpacity style={styles.card} onPress={() => onSelect(item.symbol)}>
        <View style={styles.header}>
          <View style={styles.symbolInfo}>
            <Text style={styles.symbol}>{item.symbol}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {item.analysis?.quote?.shortName || item.analysis?.quote?.longName || ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(item.symbol)}>
            <Text style={styles.removeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>${price.toFixed(2)}</Text>
          <Text style={[styles.change, { color: isPositive ? colors.accentGreen : colors.accentRed }]}>
            {isPositive ? '+' : ''}{change.toFixed(2)}%
          </Text>
        </View>

        {item.notes && (
          <Text style={styles.notes} numberOfLines={2}>
            {item.notes}
          </Text>
        )}

        {item.alertEnabled && item.alertPrice && (
          <View style={styles.alertBadge}>
            <Text style={styles.alertBadgeText}>
              🔔 {item.alertType === 'above' ? '>' : '<'} ${item.alertPrice.toFixed(2)}
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setShowNotesModal(true)}
          >
            <Text style={styles.actionBtnText}>📝 Nota</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setShowAlertModal(true)}
          >
            <Text style={styles.actionBtnText}>🔔 Alerta</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      <Modal visible={showNotesModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Notas para {item.symbol}</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Agrega tus notas..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowNotesModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleSaveNotes}>
                <Text style={styles.confirmButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showAlertModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Alerta de Precio para {item.symbol}</Text>
            
            <Text style={styles.inputLabel}>Precio actual: ${price.toFixed(2)}</Text>
            
            <Text style={styles.inputLabel}>Precio de alerta</Text>
            <TextInput
              style={styles.priceInput}
              value={alertPriceInput}
              onChangeText={setAlertPriceInput}
              keyboardType="numeric"
              placeholder="Ej: 150.00"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.inputLabel}>Tipo de alerta</Text>
            <View style={styles.alertTypeRow}>
              <TouchableOpacity
                style={[styles.alertTypeBtn, alertType === 'above' && styles.alertTypeBtnActive]}
                onPress={() => setAlertType('above')}
              >
                <Text style={[styles.alertTypeText, alertType === 'above' && styles.alertTypeTextActive]}>
                  ↑ Suba por encima de
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.alertTypeBtn, alertType === 'below' && styles.alertTypeBtnActive]}
                onPress={() => setAlertType('below')}
              >
                <Text style={[styles.alertTypeText, alertType === 'below' && styles.alertTypeTextActive]}>
                  ↓ Baje por debajo de
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.alertToggleRow}>
              <Text style={styles.alertToggleLabel}>Activar alerta</Text>
              <Switch
                value={item.alertEnabled}
                onValueChange={handleToggleAlert}
                trackColor={{ false: colors.border, true: colors.accentGreen }}
                thumbColor={colors.primary}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAlertModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleSaveAlert}>
                <Text style={styles.confirmButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  symbolInfo: {
    flex: 1,
  },
  symbol: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  name: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentRed + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: colors.accentRed,
    fontSize: 14,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 12,
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginRight: 12,
  },
  change: {
    fontSize: 16,
    fontWeight: '600',
  },
  notes: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  alertBadge: {
    backgroundColor: colors.accentBlue + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  alertBadgeText: {
    color: colors.accentBlue,
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.secondary,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  notesInput: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  priceInput: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  alertTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  alertTypeBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  alertTypeBtnActive: {
    backgroundColor: colors.accentBlue + '20',
    borderColor: colors.accentBlue,
  },
  alertTypeText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  alertTypeTextActive: {
    color: colors.accentBlue,
    fontWeight: '600',
  },
  alertToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  alertToggleLabel: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: colors.accentGreen,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: colors.primary,
    fontWeight: '600',
  },
});
