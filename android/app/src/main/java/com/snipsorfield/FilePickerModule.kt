package com.snipsorfield

import android.app.Activity
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.provider.OpenableColumns
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class FilePickerModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context), ActivityEventListener {

  private var pendingPromise: Promise? = null

  init {
    context.addActivityEventListener(this)
  }

  override fun getName(): String = "FilePicker"

  @ReactMethod
  fun pickImages(promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Unable to open Files right now.")
      return
    }

    pendingPromise = promise
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "image/*"
      putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
    }
    activity.startActivityForResult(intent, REQUEST_CODE)
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_CODE) return
    val promise = pendingPromise ?: return
    pendingPromise = null

    if (resultCode != Activity.RESULT_OK || data == null) {
      promise.resolve(Arguments.createArray())
      return
    }

    val results = Arguments.createArray()
    val clipData = data.clipData
    if (clipData != null) {
      for (index in 0 until clipData.itemCount) {
        results.pushMap(fileDetails(clipData.getItemAt(index).uri))
      }
    } else {
      data.data?.let { results.pushMap(fileDetails(it)) }
    }
    promise.resolve(results)
  }

  override fun onNewIntent(intent: Intent) = Unit

  private fun fileDetails(uri: Uri) = Arguments.createMap().apply {
    putString("uri", uri.toString())
    var cursor: Cursor? = null
    try {
      cursor = context.contentResolver.query(uri, null, null, null, null)
      if (cursor != null && cursor.moveToFirst()) {
        val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
        if (nameIndex >= 0) putString("name", cursor.getString(nameIndex))
        if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) putDouble("size", cursor.getLong(sizeIndex).toDouble())
      }
    } finally {
      cursor?.close()
    }
  }

  companion object {
    private const val REQUEST_CODE = 7412
  }
}
