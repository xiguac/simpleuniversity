// 导出用户信息 JSON：优先分享 .json 文件，失败时退回文本分享
import { Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { buildExportPayload } from './userBook';

export async function shareUsers(users) {
  const payload = buildExportPayload(users);
  const text = JSON.stringify(payload, null, 2);

  try {
    const dir = FileSystem.cacheDirectory;
    if (dir) {
      const uri = `${dir}pu-users-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(uri, text, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/json',
          dialogTitle: '导出用户信息',
        });
        return;
      }
    }
  } catch (error) {
    console.warn('JSON 文件分享失败，改用文本分享', error);
  }

  await Share.share({ message: text });
}
