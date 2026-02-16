import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ExportPayload } from '../types/models';

const backupDir = `${FileSystem.documentDirectory}backups/`;

export const writeBackupFile = async (payload: ExportPayload): Promise<string> => {
  await FileSystem.makeDirectoryAsync(backupDir, { intermediates: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileUri = `${backupDir}rifa-backup-${timestamp}.json`;

  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return fileUri;
};

export const shareBackup = async (fileUri: string): Promise<void> => {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('No se puede compartir archivos en este dispositivo');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/json',
    dialogTitle: 'Exportar rifa',
    UTI: 'public.json',
  });
};

export const pickAndReadBackup = async (): Promise<ExportPayload | null> => {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (picked.canceled) {
    return null;
  }

  const file = picked.assets[0];
  const content = await FileSystem.readAsStringAsync(file.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const parsed = JSON.parse(content) as ExportPayload;
  return parsed;
};
