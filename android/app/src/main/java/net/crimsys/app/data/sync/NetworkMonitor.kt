package net.crimsys.app.data.sync

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Live connectivity status exposed as a [StateFlow].
 *
 * Uses [ConnectivityManager.registerNetworkCallback] instead of the deprecated
 * CONNECTIVITY_ACTION broadcast (API 24+). The initial value is resolved
 * eagerly so SyncManager does not fire a doomed drain before we know.
 */
@Singleton
class NetworkMonitor @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private val _isOnline = MutableStateFlow(queryCurrentStatus())
    val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()

    /** Cold flow emitting a boolean on every connectivity change, then closing. */
    fun observe(): Flow<Boolean> = kotlinx.coroutines.flow.callbackFlow {
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                trySend(true)
            }

            override fun onLost(network: Network) {
                trySend(queryCurrentStatus())
            }

            override fun onCapabilitiesChanged(
                network: Network,
                capabilities: NetworkCapabilities,
            ) {
                trySend(capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED))
            }
        }

        val request =
            NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()
        connectivityManager.registerNetworkCallback(request, callback)

        trySend(queryCurrentStatus())
        awaitClose { connectivityManager.unregisterNetworkCallback(callback) }
    }

    private fun queryCurrentStatus(): Boolean {
        val network = connectivityManager.activeNetwork ?: return false
        val caps = connectivityManager.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }
}
