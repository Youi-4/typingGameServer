export function toAuthUserDto(user) {
  return {
    id: String(user.accountid),
    email: user.emailaddress,
    userName: user.user,
  };
}

export function toAuthStatusResponseDto(user) {
  return {
    success: true,
    user: toAuthUserDto(user),
  };
}

export function toLoginResponseDto(user) {
  return {
    success: true,
    message: "Login successful",
    user: toAuthUserDto(user),
  };
}

export function toLoggedInUserResponseDto(user) {
  return {
    user: toAuthUserDto(user),
  };
}

export function toSocketTokenResponseDto(socketToken, guestId) {
  return guestId
    ? { socketToken, guestId }
    : { socketToken };
}

export function toRefreshTokenResponseDto() {
  return {
    success: true,
    message: "Token refreshed successfully",
  };
}
