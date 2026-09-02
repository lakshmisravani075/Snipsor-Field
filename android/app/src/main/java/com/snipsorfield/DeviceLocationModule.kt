package com.snipsorfield

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Criteria
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class DeviceLocationModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context), LocationListener {

  private var pendingPromise: Promise? = null
  private val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager

  override fun getName(): String = "DeviceLocation"

  @ReactMethod
  fun getCurrentLocation(promise: Promise) {
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
      promise.reject("PERMISSION_REQUIRED", "Location permission is required.")
      return
    }

    try {
      val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
      val cached = providers.filter { locationManager.isProviderEnabled(it) }.mapNotNull { locationManager.getLastKnownLocation(it) }.maxByOrNull { it.time }
      if (cached != null && System.currentTimeMillis() - cached.time < 120000) {
        promise.resolve(toMap(cached))
        return
      }

      val criteria = Criteria().apply { accuracy = Criteria.ACCURACY_FINE }
      val provider = locationManager.getBestProvider(criteria, true)
      if (provider == null) {
        promise.reject("LOCATION_OFF", "Device location is turned off.")
        return
      }
      pendingPromise?.reject("REPLACED", "A newer location request was started.")
      pendingPromise = promise
      locationManager.requestSingleUpdate(provider, this, context.mainLooper)
    } catch (error: Exception) {
      pendingPromise = null
      promise.reject("LOCATION_ERROR", error.message, error)
    }
  }

  override fun onLocationChanged(location: Location) {
    pendingPromise?.resolve(toMap(location))
    pendingPromise = null
  }

  override fun onProviderDisabled(provider: String) = Unit
  override fun onProviderEnabled(provider: String) = Unit
  override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit

  private fun toMap(location: Location) = Arguments.createMap().apply {
    putDouble("latitude", location.latitude)
    putDouble("longitude", location.longitude)
    putDouble("accuracy", location.accuracy.toDouble())
  }
}
