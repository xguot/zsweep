<script lang="ts">
	import { resolve } from '$app/paths';
	import { Check, LogIn, UserPlus } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { supabase, ensureUserProfile } from '$lib/supabase';

	type AuthProvider = 'google' | 'github';

	interface LoginForm {
		email: string;
		password: string;
		rememberMe: boolean;
	}

	interface RegisterForm {
		username: string;
		email: string;
		password: string;
		verifyPassword: string;
	}

	let loading = $state(false);
	let errorMsg = $state('');
	let successMsg = $state('');

	let loginData: LoginForm = $state({
		email: '',
		password: '',
		rememberMe: true
	});

	let regData: RegisterForm = $state({
		username: '',
		email: '',
		password: '',
		verifyPassword: ''
	});

	async function signInWithProvider(provider: AuthProvider) {
		loading = true;
		errorMsg = '';

		const { error } = await supabase.auth.signInWithOAuth({
			provider,
			options: { redirectTo: `${window.location.origin}/profile` }
		});

		if (error) errorMsg = error.message;
		loading = false;
	}

	async function handleLogin() {
		errorMsg = '';
		const { email, password } = loginData;

		if (!email || !password) {
			errorMsg = 'Please provide both email and password.';
			return;
		}

		loading = true;
		const { data, error } = await supabase.auth.signInWithPassword({ email, password });

		if (error) {
			errorMsg = error.message;
			loading = false;
		} else {
			if (data?.user) {
				await ensureUserProfile(data.user);
			}
			goto(resolve('/profile'));
		}
	}

	async function handleRegister() {
		errorMsg = '';
		successMsg = '';
		const { email, password, username, verifyPassword } = regData;

		if (!email || !password || !username) {
			errorMsg = 'All fields are required.';
			return;
		}
		if (password !== verifyPassword) {
			errorMsg = 'Passwords do not match.';
			return;
		}

		loading = true;
		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: { data: { full_name: username, username } }
		});

		if (data?.user) {
			await ensureUserProfile(data.user);
		}

		loading = false;

		if (error) {
			errorMsg = error.message;
		} else {
			successMsg = 'Registration successful! You can now sign in.';
			regData = { username: '', email: '', password: '', verifyPassword: '' };
		}
	}
</script>

<svelte:head>
	<title>Zsweep | Login</title>
</svelte:head>

<div
	class="relative flex min-h-[75vh] flex-col items-center justify-center bg-bg px-6 py-12 font-mono text-text"
>
	<div
		class="animate-in fade-in zoom-in z-10 grid w-full max-w-4xl grid-cols-1 gap-16 duration-300 md:grid-cols-2 md:gap-24"
	>
		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleRegister();
			}}
			class="flex flex-col gap-4"
		>
			<div class="mb-1 flex items-center gap-2 text-sm text-sub">
				<UserPlus size={16} />
				<span class="font-bold lowercase">register</span>
			</div>

			<div class="space-y-3">
				<input
					type="text"
					placeholder="username"
					autocomplete="username"
					bind:value={regData.username}
					class="w-full rounded-lg border border-transparent bg-sub/10 px-3.5 py-2.5 text-sm text-text outline-none transition-all placeholder:text-sub/40 focus:border-main/60 focus:bg-sub/15"
				/>
				<input
					type="email"
					placeholder="email"
					autocomplete="email"
					bind:value={regData.email}
					class="w-full rounded-lg border border-transparent bg-sub/10 px-3.5 py-2.5 text-sm text-text outline-none transition-all placeholder:text-sub/40 focus:border-main/60 focus:bg-sub/15"
				/>
				<input
					type="password"
					placeholder="password"
					autocomplete="new-password"
					bind:value={regData.password}
					class="w-full rounded-lg border border-transparent bg-sub/10 px-3.5 py-2.5 text-sm text-text outline-none transition-all placeholder:text-sub/40 focus:border-main/60 focus:bg-sub/15"
				/>
				<input
					type="password"
					placeholder="verify password"
					autocomplete="new-password"
					bind:value={regData.verifyPassword}
					class="w-full rounded-lg border border-transparent bg-sub/10 px-3.5 py-2.5 text-sm text-text outline-none transition-all placeholder:text-sub/40 focus:border-main/60 focus:bg-sub/15"
				/>

				<button
					type="submit"
					disabled={loading}
					class="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-sub/15 py-2.5 text-sm font-bold text-text transition-colors hover:bg-main hover:text-bg disabled:opacity-50"
				>
					<UserPlus size={15} />
					<span>{loading ? 'processing...' : 'sign up'}</span>
				</button>
			</div>
		</form>

		<div class="flex flex-col gap-4">
			<div class="mb-1 flex items-center gap-2 text-sm text-sub">
				<LogIn size={16} />
				<span class="font-bold lowercase">login</span>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<button
					type="button"
					onclick={() => signInWithProvider('google')}
					disabled={loading}
					class="flex h-10 items-center justify-center gap-2 rounded-lg bg-sub/10 text-xs font-bold text-sub transition-colors hover:bg-main hover:text-bg disabled:opacity-50"
					title="Sign in with Google"
				>
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
						/>
					</svg>
					<span>google</span>
				</button>
				<button
					type="button"
					onclick={() => signInWithProvider('github')}
					disabled={loading}
					class="flex h-10 items-center justify-center gap-2 rounded-lg bg-sub/10 text-xs font-bold text-sub transition-colors hover:bg-main hover:text-bg disabled:opacity-50"
					title="Sign in with GitHub"
				>
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
						/>
					</svg>
					<span>github</span>
				</button>
			</div>

			<div class="relative my-1 flex items-center justify-center">
				<div class="h-[1px] w-full bg-sub/10"></div>
				<span class="absolute bg-bg px-3 text-[10px] uppercase tracking-widest text-sub opacity-50"
					>or</span
				>
			</div>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleLogin();
				}}
				class="space-y-3"
			>
				<input
					type="email"
					placeholder="email"
					autocomplete="email"
					bind:value={loginData.email}
					class="w-full rounded-lg border border-transparent bg-sub/10 px-3.5 py-2.5 text-sm text-text outline-none transition-all placeholder:text-sub/40 focus:border-main/60 focus:bg-sub/15"
				/>
				<input
					type="password"
					placeholder="password"
					autocomplete="current-password"
					bind:value={loginData.password}
					class="w-full rounded-lg border border-transparent bg-sub/10 px-3.5 py-2.5 text-sm text-text outline-none transition-all placeholder:text-sub/40 focus:border-main/60 focus:bg-sub/15"
				/>

				<div class="mt-1 flex items-center justify-between text-xs">
					<button
						type="button"
						class="flex select-none items-center gap-2 text-sub transition-colors hover:text-text"
						onclick={() => (loginData.rememberMe = !loginData.rememberMe)}
					>
						<div
							class="flex h-4 w-4 items-center justify-center rounded bg-sub/15 {loginData.rememberMe
								? 'text-main'
								: 'text-transparent'}"
						>
							<Check size={10} strokeWidth={4} />
						</div>
						<span>remember me</span>
					</button>
				</div>

				<button
					type="submit"
					disabled={loading}
					class="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-sub/15 py-2.5 text-sm font-bold text-text transition-colors hover:bg-main hover:text-bg disabled:opacity-50"
				>
					<LogIn size={15} />
					<span>{loading ? 'signing in...' : 'sign in'}</span>
				</button>
			</form>
		</div>
	</div>

	{#if errorMsg || successMsg}
		<div
			class="animate-in slide-in-from-bottom-2 fixed bottom-24 max-w-md rounded-lg border px-4 py-2.5 text-xs font-bold shadow-lg backdrop-blur-md
			{errorMsg ? 'border-error/30 bg-error/15 text-error' : 'border-main/30 bg-main/15 text-main'}"
		>
			{errorMsg || successMsg}
		</div>
	{/if}
</div>
