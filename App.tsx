import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AppState,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ProgressBar } from './src/components/ProgressBar';
import {
  createRaffle,
  exportPayload,
  getCurrentRaffle,
  getDashboardMetrics,
  getNumbers,
  initDatabase,
  parseRange,
  replaceWithImportedPayload,
  sellNumbers,
} from './src/db/database';
import { pickAndReadBackup, shareBackup, writeBackupFile } from './src/services/backupService';
import { DashboardMetrics, NumberEntry, Raffle } from './src/types/models';

type Screen = 'dashboard' | 'create' | 'sell' | 'numbers' | 'backup';

const initialMetrics: DashboardMetrics = {
  total: 0,
  sold: 0,
  available: 0,
  progress: 0,
  collected: 0,
};

export default function App(): JSX.Element {
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>(initialMetrics);
  const [numbers, setNumbers] = useState<NumberEntry[]>([]);
  const [filter, setFilter] = useState<'todos' | 'disponible' | 'vendido'>('todos');

  const [name, setName] = useState('Rifa principal');
  const [totalNumbers, setTotalNumbers] = useState('5000');
  const [price, setPrice] = useState('1');

  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [singleNumber, setSingleNumber] = useState('');
  const [manualNumbers, setManualNumbers] = useState('');
  const [rangeNumbers, setRangeNumbers] = useState('');

  const refreshData = useCallback(() => {
    const current = getCurrentRaffle();
    setRaffle(current);
    if (!current) {
      setMetrics(initialMetrics);
      setNumbers([]);
      return;
    }

    setMetrics(getDashboardMetrics(current.id, current.numberPrice));
    setNumbers(getNumbers(current.id, filter === 'todos' ? undefined : filter));
  }, [filter]);

  useEffect(() => {
    initDatabase();
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    refreshData();
  }, [filter, refreshData]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (state) => {
      if (state !== 'background' || !raffle) {
        return;
      }

      const payload = exportPayload(raffle.id);
      await writeBackupFile(payload);
    });

    return () => subscription.remove();
  }, [raffle]);

  const createNewRaffle = (): void => {
    const parsedTotal = Number(totalNumbers);
    const parsedPrice = Number(price);

    if (!name.trim() || parsedTotal <= 0 || parsedPrice <= 0) {
      Alert.alert('Datos inválidos', 'Completa nombre, total y precio con valores válidos');
      return;
    }

    createRaffle(name.trim(), parsedTotal, parsedPrice);
    refreshData();
    Alert.alert('Rifa creada', 'La nueva rifa se guardó correctamente');
    setScreen('dashboard');
  };

  const parseManual = (input: string): number[] => {
    if (!input.trim()) {
      return [];
    }

    return input
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => !Number.isNaN(value) && value > 0);
  };

  const submitSale = (): void => {
    if (!raffle) {
      Alert.alert('Sin rifa', 'Primero crea o importa una rifa');
      return;
    }

    if (!buyerName.trim() || !buyerPhone.trim()) {
      Alert.alert('Comprador requerido', 'Debes registrar nombre y teléfono');
      return;
    }

    const bySingle = singleNumber.trim() ? [Number(singleNumber.trim())] : [];
    const byManual = parseManual(manualNumbers);
    const byRange = rangeNumbers.trim() ? parseRange(rangeNumbers) : [];
    const all = [...bySingle, ...byManual, ...byRange].filter((n) => n > 0 && n <= raffle.totalNumbers);

    if (all.length === 0) {
      Alert.alert('Sin números', 'Debes indicar al menos un número válido');
      return;
    }

    try {
      sellNumbers(raffle, all, buyerName.trim(), buyerPhone.trim());
      setBuyerName('');
      setBuyerPhone('');
      setSingleNumber('');
      setManualNumbers('');
      setRangeNumbers('');
      refreshData();
      Alert.alert('Venta registrada', 'Los números se marcaron como vendidos');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo registrar la venta';
      Alert.alert('Error', message);
    }
  };

  const doExport = async (): Promise<void> => {
    if (!raffle) {
      Alert.alert('Sin rifa', 'Primero crea o importa una rifa');
      return;
    }

    const payload = exportPayload(raffle.id);
    const file = await writeBackupFile(payload);
    await shareBackup(file);
    Alert.alert('Exportación lista', 'Se generó y compartió el JSON de la rifa');
  };

  const doImport = async (): Promise<void> => {
    const payload = await pickAndReadBackup();
    if (!payload) {
      return;
    }

    replaceWithImportedPayload(payload);
    refreshData();
    Alert.alert('Importación completada', 'La rifa local fue reemplazada por la importada');
  };

  const topMenu = useMemo(
    () => (
      <View style={styles.menu}>
        {[
          ['dashboard', 'Inicio'],
          ['create', 'Rifa'],
          ['sell', 'Vender'],
          ['numbers', 'Números'],
          ['backup', 'Backup'],
        ].map(([key, label]) => (
          <TouchableOpacity key={key} onPress={() => setScreen(key as Screen)} style={styles.menuButton}>
            <Text style={[styles.menuLabel, screen === key ? styles.menuLabelActive : undefined]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    ),
    [screen]
  );

  return (
    <SafeAreaView style={styles.container}>
      {topMenu}
      <ScrollView contentContainerStyle={styles.content}>
        {screen === 'dashboard' && (
          <View>
            <Text style={styles.title}>{raffle?.name ?? 'Sin rifa activa'}</Text>
            <Text style={styles.subtitle}>Total: {metrics.total}</Text>
            <Text style={styles.subtitle}>Vendidos: {metrics.sold}</Text>
            <Text style={styles.subtitle}>Disponibles: {metrics.available}</Text>
            <Text style={styles.subtitle}>Recaudado: ${metrics.collected.toFixed(2)}</Text>
            <ProgressBar progress={metrics.progress} />
          </View>
        )}

        {screen === 'create' && (
          <View>
            <Text style={styles.title}>Crear o reemplazar rifa</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nombre" />
            <TextInput
              style={styles.input}
              value={totalNumbers}
              keyboardType="number-pad"
              onChangeText={setTotalNumbers}
              placeholder="Total números"
            />
            <TextInput style={styles.input} value={price} keyboardType="decimal-pad" onChangeText={setPrice} placeholder="Precio" />
            <TouchableOpacity style={styles.primaryButton} onPress={createNewRaffle}>
              <Text style={styles.primaryButtonLabel}>Guardar rifa</Text>
            </TouchableOpacity>
          </View>
        )}

        {screen === 'sell' && (
          <View>
            <Text style={styles.title}>Registrar venta</Text>
            <TextInput style={styles.input} value={buyerName} onChangeText={setBuyerName} placeholder="Nombre comprador (obligatorio)" />
            <TextInput
              style={styles.input}
              value={buyerPhone}
              onChangeText={setBuyerPhone}
              keyboardType="phone-pad"
              placeholder="Teléfono comprador (obligatorio)"
            />
            <TextInput
              style={styles.input}
              value={singleNumber}
              onChangeText={setSingleNumber}
              keyboardType="number-pad"
              placeholder="Número individual"
            />
            <TextInput
              style={styles.input}
              value={manualNumbers}
              onChangeText={setManualNumbers}
              placeholder="Múltiple manual: 1,3,7"
            />
            <TextInput style={styles.input} value={rangeNumbers} onChangeText={setRangeNumbers} placeholder="Rango: 100-150" />
            <TouchableOpacity style={styles.primaryButton} onPress={submitSale}>
              <Text style={styles.primaryButtonLabel}>Registrar venta</Text>
            </TouchableOpacity>
          </View>
        )}

        {screen === 'numbers' && (
          <View>
            <Text style={styles.title}>Listado de números</Text>
            <View style={styles.filterRow}>
              {(['todos', 'disponible', 'vendido'] as const).map((value) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setFilter(value)}
                  style={[styles.filterButton, filter === value ? styles.filterButtonActive : undefined]}
                >
                  <Text style={filter === value ? styles.filterTextActive : undefined}>{value}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <FlatList
              data={numbers}
              keyExtractor={(item) => `${item.raffleId}-${item.numberValue}`}
              renderItem={({ item }) => (
                <Text style={styles.numberRow}>
                  #{item.numberValue} - {item.state}
                  {item.state === 'vendido' ? ` (${item.buyerName} / ${item.buyerPhone})` : ''}
                </Text>
              )}
              scrollEnabled={false}
            />
          </View>
        )}

        {screen === 'backup' && (
          <View>
            <Text style={styles.title}>Backup / Importación</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={doExport}>
              <Text style={styles.primaryButtonLabel}>Exportar JSON</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={doImport}>
              <Text style={styles.secondaryButtonLabel}>Importar JSON (reemplaza completo)</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  menu: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    backgroundColor: '#0f172a',
    gap: 8,
  },
  menuButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  menuLabel: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  menuLabelActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#94a3b8',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonLabel: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonLabel: {
    color: '#0f172a',
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  filterButton: {
    borderWidth: 1,
    borderColor: '#94a3b8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  filterButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterTextActive: {
    color: '#fff',
  },
  numberRow: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
});
