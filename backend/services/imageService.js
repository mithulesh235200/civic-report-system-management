const { cloudinary, isCloudinaryConfigured } = require("../config/cloudinary");

const isRemoteImage = (value) => typeof value === "string" && /^https?:\/\//i.test(value);

const uploadImage = async (image, folder) => {
  if (!image) {
    return null;
  }

  if (isRemoteImage(image)) {
    return image;
  }

  if (!isCloudinaryConfigured()) {
    return image;
  }

  const result = await cloudinary.uploader.upload(image, {
    folder,
    resource_type: "image",
  });

  return result.secure_url;
};

module.exports = {
  uploadImage,
  isRemoteImage,
};
