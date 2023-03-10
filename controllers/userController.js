const ErrorHandler = require("../utils/errorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const userModel = require("../models/userModel");
const sendToken = require("../utils/jwtToken");
const sendEmail = require("../utils/sendEmail");
const crypto = require("crypto");
const User = require("../models/userModel");
const cloudinary = require("cloudinary");

//  Register new users.
exports.registerUser = catchAsyncErrors(async (req, res, next) => {
  const myCloud = await cloudinary.v2.uploader.upload(req.body.avatar, {
    folder: "avatars",
    width: 150,
    crop: "scale",
  });

  const { name, email, password } = req.body;
  const user = await userModel.create({
    name,
    email,
    password,
    avatar: {
      public_id: myCloud.public_id,
      url: myCloud.secure_url,
    },
  });
  sendToken(user, 201, res);
});

// Login User
exports.loginUser = catchAsyncErrors(async (req, res, next) => {
  const { email, password } = req.body;

  // checking if user has given password and email both
  if (!email || !password) {
    return next(new ErrorHandler("Please enter email and password"));
  }

  const user = await userModel.findOne({ email }).select("+password");

  if (!user) {
    return next(new ErrorHandler("Invalid email or password", 401));
  }

  const isPasswordMatched = await user.comparePassword(password);

  if (!isPasswordMatched) {
    return next(new ErrorHandler("Invalid email or password", 401));
  }

  sendToken(user, 200, res);
});

exports.logoutUser = catchAsyncErrors(async (req, res, next) => {
  res.cookie("token", null, {
    expires: new Date(Date.now()),
    httpsOnly: true,
  });

  res.status(200).json({
    success: true,
    message: "Logged Out",
  });
});

// FORGOT PASSWORD
exports.forgotPassword = catchAsyncErrors(async (req, res, next) => {
  const user = await userModel.findOne({ email: req.body.email });

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  const resetToken = user.getResetPasswordToken();

  await user.save({ validateBeforeSave: false });

  const resetPasswordUrl = `${req.protocol}://${req.get(
    "host"
  )}password/reset/${resetToken}`;

  const message = `Your password reset token is :- \n\n ${resetPasswordUrl} \n\n If you have not requested this email then 
  , please ignore it `;

  try {
    await sendEmail({
      email: user.email,
      subject: "Ace Password Recovery",
      message,
    });

    res.status(200).json({
      success: true,
      message: `Email sent to ${user.email} successfully`,
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save({ validateBeforeSave: false });

    return next(new ErrorHandler(error.message, 500));
  }
});

// Reset Password
exports.resetPassword = catchAsyncErrors(async (req, res, next) => {
  // creating token hash
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await userModel.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  console.log(user);

  if (!user) {
    return next(
      new ErrorHandler(
        "Reset Password Token is invalid or has been expired.",
        400
      )
    );
  }

  if (req.body.password !== req.body.confirmPassword) {
    return next(new ErrorHandler("Password does not match", 400));
  }

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();

  sendToken(user, 200, res);
});

// Get User Detail
exports.getUserDetails = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    sucess: true,
    user,
  });
});

// Update user password
exports.updatePassword = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("+password");

  const isPasswordMatched = await user.comparePassword(req.body.oldPassword);

  if (!isPasswordMatched) {
    return next(new ErrorHandler("Old Password is incorrect", 400));
  }

  if (req.body.newPassword !== req.body.confirmPassword) {
    return next(
      new ErrorHandler("Confirm Password and New Password does not match", 400)
    );
  }

  user.password = req.body.newPassword;
  await user.save();
  sendToken(user, 200, res);
});

// Update user PROFILE
exports.updateUserProfile = catchAsyncErrors(async (req, res, next) => {
  const newUserData = {
    name: req.body.name,
    email: req.body.email,
  };

  // we will add cloudinary later.
  if (req.body.avatar != "") {
    const user = await User.findById(req.user.id);
    const imageId = user.avatar.public_id;

    await cloudinary.v2.uploader.destroy(imageId);

    const myCloud = await cloudinary.v2.uploader.upload(req.body.avatar, {
      folder: "avatars",
      width: 150,
      crop: "scale",
    });

    newUserData.avatar = {
      public_id: myCloud.public_id,
      url: myCloud.secure_url,
    };
  }
  const user = await userModel.findByIdAndUpdate(req.user.id, newUserData, {
    new: true,
    runValidators: true,
    userFindandModify: false,
  });

  res.status(200).json({
    success: true,
  });
});

// Get all users (admin)
exports.getAllUsers = catchAsyncErrors(async (req, res, next) => {
  const users = await userModel.find();

  res.status(200).json({
    success: true,
    users,
  });
});

// Get single users (admin)
exports.getSingleUser = catchAsyncErrors(async (req, res, next) => {
  const user = await userModel.findById(req.params.id);

  if (!user) {
    return next(
      new ErrorHandler(`User does not exist with id : ${req.params.id}`, 400)
    );
  }

  res.status(200).json({
    success: true,
    user,
  });
});

// Update user role - admin
exports.updateUserRole = catchAsyncErrors(async (req, res, next) => {
  const newUserData = {
    name: req.body.name,
    email: req.body.email,
    role: req.body.role,
  };

  const user = await userModel.findByIdAndUpdate(req.params.id, newUserData, {
    new: true,
    runValidators: true,
    userFindandModify: false,
  });

  res.status(200).json({
    success: true,
  });
});

// Delete User - admin
exports.deleteUser = catchAsyncErrors(async (req, res, next) => {
  const user = await userModel.findById(req.params.id);

  if (!user) {
    return next(
      new ErrorHandler(`User does not exist with id : ${req.params.id}`, 400)
    );
  }

  const imageId = user.avatar.public_id;

  await cloudinary.v2.uploader.destroy(imageId);

  await user.remove();

  res.status(200).json({
    success: true,
    message: "User has been deleted successfully",
  });
});
