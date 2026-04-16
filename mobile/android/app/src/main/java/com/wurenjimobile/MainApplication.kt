package com.wurenjimobile

import android.app.Application
import com.amap.api.maps.MapsInitializer
import cn.jiguang.api.utils.JCollectionAuth
import cn.jpush.android.api.JPushInterface
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import cn.reactnative.modules.update.UpdateContext

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
        },
      jsBundleFilePath = UpdateContext.getBundleUrl(this),
    )
  }

  override fun onCreate() {
    super.onCreate()
    MapsInitializer.updatePrivacyShow(this, true, true)
    MapsInitializer.updatePrivacyAgree(this, true)
    JCollectionAuth.setAuth(this, true)
    JPushInterface.setDebugMode(BuildConfig.DEBUG)
    JPushInterface.init(this)
    JPushInterface.resumePush(this)
    JPushInterface.setNotificationCallBackEnable(this, true)
    loadReactNative(this)
  }
}
