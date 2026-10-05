import React, { useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { AuthContext } from "../../../contexts/AuthContext";
import { getCategoryName } from "../../../utils/forumUtils";
import {
  updatePost,
  getSubforums,
  uploadFile,
  getPostDetail,
} from "../../../services/api/Api";
import Toast from "react-native-toast-message";
import { FeedContext } from "../../../contexts/FeedContext";
import { compressImageForUpload, compressVideoForUpload } from "../../../utils/mediaCompression";
import { startUpload } from "../../../services/uploadQueue";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { CommonActions } from "@react-navigation/native";
import { autoEmbedYouTubeLinks } from "../../../utils/youtubeShare";
import { autoEmbedSoundCloudLinks } from "../../../utils/soundcloudShare";
import usePostEditor from "../../../components/PostEditor/usePostEditor";
import PostComposerLayout from "../../../components/PostEditor/PostComposerLayout";
import { hasPendingUploads } from "../../../utils/markdownEdit";

import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { useStatusBarStyle } from "../../../hooks/useStatusBarUpdate";
import {
  getVideoExtension,
  getVideoMimeType,
  validateVideoAsset,
} from "../../../utils/videoUpload";

// Large video/image/document uploads (up to 100MB) need more headroom than
// the default upload timeout.
const VIDEO_UPLOAD_TIMEOUT = 300000;
const HEAVY_UPLOAD_TIMEOUT = 300000;

const PostEditScreen = ({ navigation, route }) => {
  const [title, setTitle] = useState("");
  const { userInfo } = useContext(AuthContext);
  // Same GitHub-style editor as CreatePostScreen (toolbar, preview, undo,
  // mentions, inline images); filled in with the post once it has loaded.
  const editor = usePostEditor({ initialContent: "", userId: userInfo?.id });
  const { postContent } = editor;
  if (!userInfo) {
    return null;
  }
  const { theme, isDarkMode } = useTheme();
  useStatusBarStyle(
    isDarkMode ? "light-content" : "dark-content",
    Platform.OS === "android" ? "transparent" : theme.background,
  );
  const { setFeed } = useContext(FeedContext);
  const [selected, setSelected] = useState(null);
  const [subforums, setSubforums] = useState([]);
  const { t } = useTranslation();
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [viewSelected, setViewSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [initialPost, setInitialPost] = useState(null);

  const viewOptions = isAnonymous ? [
    { label: t('editPost.public'), value: "public", icon: "earth" },
    { label: t('editPost.private'), value: "private", icon: "lock-closed" },
  ] : [
    { label: t('editPost.public'), value: "public", icon: "earth" },
    { label: t('createPost.privacyFollowers'), value: "followers", icon: "people" },
    { label: t('editPost.private'), value: "private", icon: "lock-closed" },
  ];

  useEffect(() => {
    if (isAnonymous && viewSelected?.value === 'followers') {
      setViewSelected(viewOptions[0]);
    }
  }, [isAnonymous]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [postRes, subforumsRes] = await Promise.all([
          getPostDetail(route.params.postId),
          getSubforums(),
        ]);

        // Handle both array-direct and data-wrapped responses
        const d = subforumsRes.data;
        const rawSubforums = Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []);

        const translatedSubforums = rawSubforums.map(item => {
          const id = item.value ?? item.id;
          const name = item.label || item.name || item.title || "";
          return {
            ...item,
            value: id,
            label: getCategoryName(name, t),
            // The dropdown groups options under `category` (the parent section,
            // e.g. "Thông báo", "Học tập") - translate that header too.
            category: item.category ? getCategoryName(item.category, t) : item.category,
          };
        });
        setSubforums(translatedSubforums);

        // ── Post data ─────────────────────────────────────────────────────────
        const post = postRes.data?.post ?? postRes.data;
        setInitialPost(post);

        setTitle(post.title || "");
        editor.reset(post.description || post.content || "");
        setIsAnonymous(!!post.anonymous);

        const initialPrivacy = post.privacy || (post.visibility === 1 ? "private" : "public");
        const matchingOption = viewOptions.find(v => v.value === initialPrivacy) || viewOptions[0];
        setViewSelected(matchingOption);

        // ── Category pre-selection ────────────────────────────────────────────
        const subforumId =
          post.subforum_id ??
          post.subforum?.id ??
          post.category_id ??
          post.category?.id ??
          null;

        if (subforumId !== null && subforumId !== undefined) {
          let matched = translatedSubforums.find(
            (s) => String(s.value) === String(subforumId)
          );

          // The v1.0 subforum list is role-filtered, so the post's current subforum
          // might not be in the list. If missing, synthesize an entry from post.subforum
          // so the dropdown always shows the correct pre-selected category.
          if (!matched && (post.subforum || post.category)) {
            const sf = post.subforum || post.category;
            const syntheticLabel = getCategoryName(
              sf.name || sf.title || String(subforumId),
              t
            );
            matched = {
              value: subforumId,
              label: syntheticLabel,
              category: getCategoryName(sf.category?.name || sf.parent?.name || '', t),
            };
            // Prepend so it's visible at the top of the dropdown
            setSubforums(prev => {
              const alreadyIn = prev.some(s => String(s.value) === String(subforumId));
              return alreadyIn ? prev : [matched, ...prev];
            });
          }

          if (matched) setSelected(matched);
        }

        if (post.images && post.images.length > 0) {
          setSelectedImages(post.images.map(img => ({ id: img.id, uri: img.url })));
        } else if (post.cdn_image_id) {
          const imageUrls = post.cdn_image_id
            .split(",")
            .map((id) => ({ id: id, uri: `https://api.chuyenbienhoa.com/v1.0/cdn/${id}` }));
          setSelectedImages(imageUrls);
        }

        if (post.documents && post.documents.length > 0) {
          setSelectedDocuments(post.documents.map(doc => ({
            id: doc.id,
            uri: doc.url,
            name: doc.name || decodeURIComponent(doc.url.split('/').pop()).replace(/^\d+_/, '')
          })));
        }

        if (post.videos && post.videos.length > 0) {
          setSelectedVideos(post.videos.map(video => ({ id: video.id, uri: video.url })));
        } else if (post.video_urls && post.video_urls.length > 0) {
          setSelectedVideos(post.video_urls.map((url) => ({ uri: url })));
        }
      } catch (error) {
        console.log("Error fetching post:", error);
        Toast.show({
          type: "error",
          text1: t('editPost.errorLoadTitle'),
          text2: t('editPost.errorLoadDesc'),
          autoHide: true,
          visibilityTime: 3000,
          topOffset: 60,
        });
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    if (route.params?.postId) {
      fetchData();
    } else {
      navigation.goBack();
    }
  }, [route.params?.postId]);

  const pickImage = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets) {
        setSelectedImages((prev) => [
          ...prev,
          ...result.assets.map((asset) => ({ uri: asset.uri })),
        ]);
      }
    } catch (error) {
      console.log("Error picking image:", error);
      Toast.show({
        type: "error",
        text1: t('editPost.errorImageTitle'),
        text2: t('editPost.errorImageDesc'),
        autoHide: true,
        visibilityTime: 3000,
        topOffset: 60,
      });
    }
  };

  const pickDocument = async () => {
    try {
      let result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        setSelectedDocuments((prev) => [...prev, ...result.assets]);
      }
    } catch (error) {
      console.log("Error picking document:", error);
      Toast.show({
        type: "error",
        text1: t('createPost.pickDocumentError'),
        text2: t('createPost.retry'),
        autoHide: true,
        visibilityTime: 3000,
        topOffset: 60,
      });
    }
  };

  const pickVideo = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsMultipleSelection: true,
        // iOS exports the pick as 720p H.264 (ignored on Android).
        videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
      });

      if (result.canceled || !result.assets) return;

      const accepted = [];
      let hadTypeRejection = false;
      let hadSizeRejection = false;

      for (const asset of result.assets) {
        const validation = await validateVideoAsset(asset);
        if (!validation.ok) {
          if (validation.reason === "type") hadTypeRejection = true;
          if (validation.reason === "size") hadSizeRejection = true;
          continue;
        }
        accepted.push({
          uri: asset.uri,
          fileName: asset.fileName || `video_${Date.now()}.${validation.extension}`,
          mimeType: asset.mimeType || getVideoMimeType(validation.extension),
          fileSize: validation.size,
        });
      }

      if (hadTypeRejection) {
        Toast.show({
          type: "error",
          text1: t('editPost.errorVideoTitle') || t('createPost.pickVideoError'),
          text2: t('editPost.videoTypeUnsupported') || t('createPost.videoTypeUnsupported'),
          autoHide: true,
          visibilityTime: 4000,
          topOffset: 60,
        });
      }
      if (hadSizeRejection) {
        Toast.show({
          type: "error",
          text1: t('editPost.errorVideoTitle') || t('createPost.pickVideoError'),
          text2: t('editPost.videoTooLarge') || t('createPost.videoTooLarge'),
          autoHide: true,
          visibilityTime: 4000,
          topOffset: 60,
        });
      }

      if (accepted.length > 0) {
        setSelectedVideos((prev) => [...prev, ...accepted]);
      }
    } catch (error) {
      console.log("Error picking video:", error);
      Toast.show({
        type: "error",
        text1: t('editPost.errorVideoTitle') || t('createPost.pickVideoError'),
        text2: t('editPost.errorVideoDesc') || t('createPost.retry'),
        autoHide: true,
        visibilityTime: 3000,
        topOffset: 60,
      });
    }
  };

  const removeVideo = (indexToRemove) => {
    setSelectedVideos((prev) =>
      prev.filter((_, index) => index !== indexToRemove)
    );
  };

  const removeImage = (indexToRemove) => {
    setSelectedImages((prev) =>
      prev.filter((_, index) => index !== indexToRemove)
    );
  };

  const removeDocument = (indexToRemove) => {
    setSelectedDocuments((prev) =>
      prev.filter((_, index) => index !== indexToRemove)
    );
  };

  const handleUpdate = () => {
    if (title.trim() === "" || postContent.trim() === "") {
      Toast.show({
        type: "error",
        text1: t('editPost.errorUpdateTitle'),
        text2: t('editPost.errorUpdateDesc'),
        autoHide: true,
        visibilityTime: 5000,
        topOffset: 60,
      });
      return;
    }

    // A placeholder still in the text would be saved as literal text.
    if (hasPendingUploads(editor.contentRef.current)) {
      Toast.show({
        type: "info",
        text1: t('editPost.errorUpdateTitle'),
        text2: t("createPost.uploadsPending"),
        autoHide: true,
        visibilityTime: 4000,
        topOffset: 60,
      });
      return;
    }

    // Saving runs in the background (services/uploadQueue), like posting:
    // the editor closes right away and the upload bar / notification report
    // compressing and uploading. Everything the task needs is read here.
    const postId = route.params.postId;
    const images = [...selectedImages];
    const documents = [...selectedDocuments];
    const videos = [...selectedVideos];
    const author = userInfo;
    const draft = {
      title,
      // Auto-wraps a bare youtube.com/youtu.be link typed into the post
      // in the same <iframe> PostItem already knows how to render.
      description: autoEmbedSoundCloudLinks(autoEmbedYouTubeLinks(postContent)),
      subforum_id: selected?.value ?? null,
      visibility: viewSelected?.value === "private" ? 1 : 0, // Fallback if needed
      privacy: viewSelected?.value,
      anonymous: isAnonymous,
    };

    startUpload({
      kind: "postEdit",
      task: async (report) => {
        // Kept IDs
        const keptImageIds = images.filter((img) => img.id).map((img) => img.id);
        const keptDocumentIds = documents.filter((doc) => doc.id).map((doc) => doc.id);
        const keptVideoIds = videos.filter((video) => video.id).map((video) => video.id);

        const newImages = images.filter((img) => !img.id && img.uri);
        const newDocs = documents.filter((doc) => !doc.id && doc.uri);
        const newVideos = videos.filter((video) => !video.id && video.uri);

        // One bar for the whole save: each new file is an equal share of it.
        const totalFiles = newImages.length + newDocs.length + newVideos.length;
        let filesDone = 0;
        const overall = (ratio) => (filesDone + ratio) / totalFiles;

        const newCdnIds = [];
        for (const img of newImages) {
          // Compressed on the device (the API no longer does it).
          report("compressingImage", { progress: overall(0) });
          const imageUri = await compressImageForUpload(img.uri);
          const formData = new FormData();
          const fileExtension = imageUri?.split(".").pop() || "jpg";
          let mimeType = "image/jpeg";
          if (fileExtension === "png") {
            mimeType = "image/png";
          } else if (fileExtension === "gif") {
            mimeType = "image/gif";
          }

          formData.append("uid", author.id);
          formData.append("file", {
            uri: imageUri,
            name: `image.${fileExtension}`,
            type: mimeType,
          });

          report("uploading", { progress: overall(0) });
          const uploadResponse = await uploadFile(formData, {
            timeout: HEAVY_UPLOAD_TIMEOUT,
            onUploadProgress: (progressEvent) => {
              if (!progressEvent.total) return;
              report.progress("uploading", { progress: overall(progressEvent.loaded / progressEvent.total) });
            },
          });
          newCdnIds.push(uploadResponse.data.id);
          filesDone += 1;
        }

        const newDocIds = [];
        for (const dock of newDocs) {
          const formData = new FormData();

          formData.append("uid", author.id);
          formData.append("file", {
            uri: dock.uri,
            name: dock.name || `document.${dock.uri?.split(".").pop() || "bin"}`,
            type: dock.mimeType || "application/octet-stream",
          });

          report("uploading", { progress: overall(0) });
          const uploadResponse = await uploadFile(formData, {
            timeout: HEAVY_UPLOAD_TIMEOUT,
            onUploadProgress: (progressEvent) => {
              if (!progressEvent.total) return;
              report.progress("uploading", { progress: overall(progressEvent.loaded / progressEvent.total) });
            },
          });
          newDocIds.push(uploadResponse.data.id);
          filesDone += 1;
        }

        // New videos - same upload/kept-id pattern as images/documents
        // above, with a longer timeout since they can be up to 100MB.
        const newVideoIds = [];
        for (let i = 0; i < newVideos.length; i++) {
          const video = newVideos[i];
          const count = { current: i + 1, total: newVideos.length };
          const formData = new FormData();
          const extension = getVideoExtension(video.fileName || video.uri) || "mp4";

          // Compressed on the device to 720p H.264 (the API no longer does
          // it): first half of this file's share of the bar, upload second.
          report("compressingVideo", { ...count, progress: overall(0) });
          const compressed = await compressVideoForUpload(video.uri, (ratio) =>
            report.progress("compressingVideo", { ...count, progress: overall(ratio * 0.5) }),
          );

          formData.append("uid", author.id);
          formData.append("file", {
            uri: compressed.uri,
            // The compressor always writes an MP4.
            name: compressed.compressed
              ? `${(video.fileName || "video").replace(/\.[^.]*$/, "")}.mp4`
              : video.fileName || `video.${extension}`,
            type: compressed.compressed ? "video/mp4" : video.mimeType || getVideoMimeType(extension),
          });

          report("uploadingVideo", { ...count, progress: overall(0.5) });
          const uploadResponse = await uploadFile(formData, {
            timeout: VIDEO_UPLOAD_TIMEOUT,
            onUploadProgress: (progressEvent) => {
              if (!progressEvent.total) return;
              const fileProgress = progressEvent.loaded / progressEvent.total;
              report.progress("uploadingVideo", { ...count, progress: overall(0.5 + fileProgress * 0.5) });
            },
          });
          newVideoIds.push(uploadResponse.data.id);
          filesDone += 1;
        }

        // Get existing CDN IDs from kept IDs or fallback to parsing from URLs
        const urlImageIds = images
          .filter((img) => !img.id && img.uri && img.uri.includes("api.chuyenbienhoa.com"))
          .map((img) => img.uri.split("/").pop());
        const allCdnIds = [...new Set([...keptImageIds, ...urlImageIds, ...newCdnIds])];

        const urlDocIds = documents
          .filter((doc) => !doc.id && doc.uri && doc.uri.includes("api.chuyenbienhoa.com"))
          .map((doc) => doc.uri.split("/").pop());
        const allDocIds = [...new Set([...keptDocumentIds, ...urlDocIds, ...newDocIds])];

        const urlVideoIds = videos
          .filter((video) => !video.id && video.uri && video.uri.includes("api.chuyenbienhoa.com"))
          .map((video) => video.uri.split("/").pop());
        const allVideoIds = [...new Set([...keptVideoIds, ...urlVideoIds, ...newVideoIds])];

        report("finishing");
        const response = await updatePost(postId, {
          ...draft,
          kept_image_ids: allCdnIds.length > 0 ? allCdnIds.join(",") : null,
          cdn_image_id: allCdnIds.length > 0 ? allCdnIds.join(",") : null,
          kept_document_ids: allDocIds.length > 0 ? allDocIds.join(",") : null,
          cdn_document_id: allDocIds.length > 0 ? allDocIds.join(",") : null,
          kept_video_ids: allVideoIds.length > 0 ? allVideoIds.join(",") : null,
          cdn_video_id: allVideoIds.length > 0 ? allVideoIds.join(",") : null,
        });

        const updatedPostData = response.data?.post || response.data;
        setFeed((prevPosts) =>
          prevPosts?.map((post) =>
            post.id === postId ? { ...post, ...updatedPostData, is_mine: true, is_author: true, author: { ...post.author, ...author, ...updatedPostData?.author }, anonymous: updatedPostData?.anonymous ?? draft.anonymous } : post
          ) ?? prevPosts
        );

        return response;
      },
    });

    // Back to the feed while the changes are saved.
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "MainScreens" }],
      })
    );
  };

  const navigateToHelp = (postId) => {
    if (!navigation) return;

    try {
      navigation.goBack();
      setTimeout(() => {
        try {
          navigation.navigate("PostScreen", { postId });
        } catch (error) {
          console.log("Navigation error:", error);
        }
      }, 100);
    } catch (error) {
      console.log("Navigation error:", error);
    }
  };

  // The look (header, cards, toolbar) is PostComposerLayout, shared with the
  // create screen; until the post has loaded it shows the app's loader.
  return (
    <PostComposerLayout
      editor={editor}
      loading={!initialPost}
      headerTitle={t("editPost.title")}
      onClose={() => navigation.goBack()}
      submitLabel={t("editPost.save")}
      onSubmit={handleUpdate}
      title={title}
      onChangeTitle={setTitle}
      titlePlaceholder={t("editPost.placeholderTitle")}
      contentPlaceholder={t("editPost.placeholderContent")}
      onMarkdownHelp={() => navigateToHelp(213057)}
      onRulesHelp={() => navigateToHelp(213054)}
      categoryOptions={subforums}
      category={selected}
      onChangeCategory={setSelected}
      privacyOptions={viewOptions}
      privacy={viewSelected}
      onChangePrivacy={setViewSelected}
      // Shown, but can't be changed once the post exists.
      anonymous={isAnonymous}
      images={selectedImages}
      videos={selectedVideos}
      documents={selectedDocuments}
      onPickImage={pickImage}
      onPickVideo={pickVideo}
      onPickDocument={pickDocument}
      onRemoveImage={removeImage}
      onRemoveVideo={removeVideo}
      onRemoveDocument={removeDocument}
    />
  );
};

export default PostEditScreen;
