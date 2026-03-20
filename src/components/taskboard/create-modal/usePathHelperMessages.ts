import { useCallback, useMemo } from "react";
import { isApiRequestError } from "../../../api";
import type { Locale, TFunction } from "../constants";

export function usePathHelperMessages(t: TFunction) {
  const unsupportedPathApiMessage = useMemo(
    () =>
      t({
        ko: ".   .",
        en: "This server does not support path helper APIs. Enter the path manually.",
        ja: "現在のサーバーではパス補助 API をサポートしていません。手入力してください。",
        zh: "当前服务器不支持路径辅助 API，请手动输入路径。",
        ru: "Этот сервер не поддерживает API помощника пути. Введите путь вручную.",
      }),
    [t],
  );

  const nativePickerUnavailableMessage = useMemo(
    () =>
      t({
        ko: ".        .",
        en: "OS folder picker is unavailable in this environment. Use in-app browser or manual input.",
        ja: "この環境では OS フォルダ選択が利用できません。アプリ内閲覧または手入力を使ってください。",
        zh: "当前无使用系统文件夹选择器，请使用应内浏览或手动输入。",
        ru: "Системный выбор папки недоступен. Используйте встроенный браузер или ввод вручную.",
      }),
    [t],
  );

  const formatAllowedRootsMessage = useCallback(
    (allowedRoots: string[]) => {
      if (allowedRoots.length === 0) {
        return t({
          ko: ".",
          en: "Path is outside allowed project roots.",
          ja: "許可されたプロジェクトパス範囲外です。",
          zh: "路径超出允许的项根目录范围。",
          ru: "Путь выходит за пределы разрешённых корневых директорий.",
        });
      }
      return t({
        ko: "",
        en: `Path is outside allowed project roots. Allowed roots: ${allowedRoots.join(", ")}`,
        ja: `許可されたプロジェクトパス範囲外です。許可パス: ${allowedRoots.join(", ")}`,
        zh: `路径超出允许的项目根目录范围。允许路径：${allowedRoots.join(", ")}`,
        ru: `Путь выходит за пределы разрешённых директорий. Разрешены: ${allowedRoots.join(", ")}`,
      });
    },
    [t],
  );

  const resolvePathHelperErrorMessage = useCallback(
    (error: unknown, fallback: import("../../../i18n").LangText) => {
      if (!isApiRequestError(error)) return t(fallback);

      if (error.status === 404) {
        return unsupportedPathApiMessage;
      }
      if (error.code === "project_path_outside_allowed_roots") {
        const allowedRoots = Array.isArray((error.details as { allowed_roots?: unknown })?.allowed_roots)
          ? (error.details as { allowed_roots: unknown[] }).allowed_roots.filter(
              (item): item is string => typeof item === "string" && item.trim().length > 0,
            )
          : [];
        return formatAllowedRootsMessage(allowedRoots);
      }
      if (error.code === "native_picker_unavailable" || error.code === "native_picker_failed") {
        return nativePickerUnavailableMessage;
      }
      if (error.code === "project_path_not_directory") {
        return t({
          ko: ".   .",
          en: "This path is not a directory. Please enter a directory path.",
          ja: "このパスはフォルダではありません。ディレクトリパスを入してください。",
          zh: "该路径不是文件夹，请输入目录路径。",
          ru: "Этот путь не является директорией. Введите путь к директории.",
        });
      }
      if (error.code === "project_path_not_found") {
        return t({
          ko: ".",
          en: "Path not found.",
          ja: "パスが見つかりません。",
          zh: "找不到该路径。",
          ru: "Путь не найден.",
        });
      }
      return t(fallback);
    },
    [formatAllowedRootsMessage, nativePickerUnavailableMessage, t, unsupportedPathApiMessage],
  );

  return {
    unsupportedPathApiMessage,
    nativePickerUnavailableMessage,
    resolvePathHelperErrorMessage,
  };
}
