import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import AMapFoundationKit
import MAMapKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // 高德地图 SDK 隐私合规（必须在 apiKey 和 MAMapView 实例化之前调用）
    MAMapView.updatePrivacyShow(AMapPrivacyShowStatus.didShow, privacyInfo: AMapPrivacyInfoStatus.didContain)
    MAMapView.updatePrivacyAgree(AMapPrivacyAgreeStatus.didAgree)

    // 初始化高德地图 SDK
    if let amapKey = Bundle.main.object(forInfoDictionaryKey: "AMapApiKey") as? String, !amapKey.isEmpty {
      AMapServices.shared().enableHTTPS = true
      AMapServices.shared().apiKey = amapKey
      print("[AMap] SDK Key loaded: \(amapKey.prefix(8))..., HTTPS enabled, privacy agreed")
    } else {
      print("[AMap] WARNING: AMapApiKey not found or empty in Info.plist!")
    }

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "WurenjiMobile",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    // 开发模式：连接 Metro bundler
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
